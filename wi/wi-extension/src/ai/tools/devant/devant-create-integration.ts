// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com/) All Rights Reserved.

// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at

// http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import * as path from "path";
import * as vscode from "vscode";
import { tool, jsonSchema } from "ai";
import { ComponentKind, DevantToolEventHandler, getTypeOfIntegrationType, makeURLSafe, parseGitURL, Project } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { contextStore } from "../../../cloud/stores/context-store";
import { dataCacheStore } from "../../../cloud/stores/data-cache-store";
import { updateContextFile as updateContextFileUtil } from "../../../cloud/cmds/create-directory-context-cmd";
import { getGitRoot } from "../../../cloud/git/util";
import { StateMachine, ProjectType } from "../../../stateMachine";

export const DEVANT_CREATE_INTEGRATION_TOOL = "DevantCreateIntegrationTool";

export interface DevantCreateIntegrationInput {
    orgId: string;
    orgHandle: string;
    projectHandler: string;
    componentName: string;
    integrationType: "integration-as-api" | "automation" | "event-integration" | "file-integration" | "ai-agent";
    repoUrl: string;
    branch: string;
    componentDir?: string;
    credentialId?: string;
}

export interface DevantCreateIntegrationResult {
    requiresAuth: boolean;
    message?: string;
    authorizationUrl?: string;
    component?: ComponentKind;
}

const DevantCreateIntegrationSchema = jsonSchema<DevantCreateIntegrationInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: "Numeric ID of the organization. Obtain from DevantGetWorkspaceContextTool (selectedOrg.id) or DevantListOrgsTool.",
        },
        orgHandle: {
            type: "string",
            description: "Handle (slug) of the organization. Obtain from DevantGetWorkspaceContextTool (selectedOrg.handle) or DevantListOrgsTool.",
        },
        projectHandler: {
            type: "string",
            description: "Handler (slug) of the project. Obtain from DevantGetWorkspaceContextTool (selectedProject.handler) or DevantListProjectsTool.",
        },
        componentName: {
            type: "string",
            description: "Display name of the new integration component. Automatically derived from the source — do NOT ask the user. See detection rules in the tool description.",
        },
        integrationType: {
            type: "string",
            enum: ["integration-as-api", "automation", "event-integration", "file-integration", "ai-agent"],
            description: "The Devant integration type, automatically determined by analyzing the workspace source code. Do NOT ask the user — derive it using the detection rules described in the tool description.",
        },
        repoUrl: {
            type: "string",
            description: "Full HTTPS git repository URL (e.g. https://github.com/acme/payments). Obtain from DevantGetGitInfoTool: use the fetchUrl of the 'origin' remote (or first remote), stripping credentials and the .git suffix.",
        },
        branch: {
            type: "string",
            description: "Git branch to deploy from. Obtain from DevantGetGitInfoTool (branch field). Confirm with the user if they want a different branch. Ask the user if branch is undefined (detached HEAD).",
        },
        componentDir: {
            type: "string",
            description: "Full filesystem path of the integration directory (e.g. /Users/foo/projects/my-repo/services/payment). The tool computes the repo-relative path internally.",
        },
        credentialId: {
            type: "string",
            description: "ID of the git credential to use for non-GitHub repos. Obtain from DevantGetCredentialsTool. Required for Bitbucket and GitLab repos.",
        },
    },
    required: ["orgId", "orgHandle", "projectHandler", "componentName", "integrationType", "repoUrl", "branch"],
});

async function getConfig() {
    return ext.config ?? await ext.clients.rpcClient.getConfigFromCli();
}

async function buildGithubState(orgId: string): Promise<string> {
    const callbackUrl = await vscode.env.asExternalUri(
        vscode.Uri.parse(`${vscode.env.uriScheme}://wso2.wso2-integrator/ghapp`)
    );
    return Buffer.from(
        JSON.stringify({
            origin: "vscode.choreo.ext",
            orgId,
            callbackUri: callbackUrl.toString(),
            extensionName: "Devant",
        }),
        "binary",
    ).toString("base64");
}

export async function devantCreateIntegration(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantCreateIntegrationInput,
): Promise<DevantCreateIntegrationResult> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_CREATE_INTEGRATION_TOOL,
        toolInput: input,
        toolCallId,
    });

    // 1. Resolve org and project from explicit inputs
    const userInfo = ext.authProvider?.getState().state?.userInfo;
    if (!userInfo) {
        throw new Error("User not authenticated. Please sign in to Devant first.");
    }
    const org = userInfo.organizations?.find((o) => o.handle === input.orgHandle);
    if (!org) {
        throw new Error(`Organization "${input.orgHandle}" not found. Call DevantListOrgsTool to verify the org handle.`);
    }
    const projects = await ext.clients.rpcClient.getProjects(input.orgId);
    const project = projects.find((p: Project) => p.handler === input.projectHandler);
    if (!project) {
        throw new Error(`Project "${input.projectHandler}" not found in organization "${input.orgHandle}". Call DevantListProjectsTool to verify the project handler.`);
    }

    const orgId = input.orgId;

    // 2. Detect git provider from URL
    const parsed = parseGitURL(input.repoUrl);
    if (!parsed) {
        const result: DevantCreateIntegrationResult = {
            requiresAuth: false,
            message: `The repository URL "${input.repoUrl}" is not a valid git URL. Please verify the URL and try again.`,
        };
        eventHandler({
            type: "tool_result",
            toolName: DEVANT_CREATE_INTEGRATION_TOOL,
            toolOutput: result,
            toolCallId,
        });
        return result;
    }
    const [, , gitProvider] = parsed;

    // 3. Check repo authorization
    const authResp = await ext.clients.rpcClient.isRepoAuthorized({
        orgId,
        repoUrl: input.repoUrl,
        credRef: input.credentialId ?? "",
    });

    // 4. Handle authorization failure
    if (!authResp.isAccessible) {
        const config = await getConfig();
        let result: DevantCreateIntegrationResult;

        if (gitProvider === "github") {
            const state = await buildGithubState(orgId);

            if (!authResp.retrievedRepos) {
                // No GitHub access at all — full OAuth flow
                const authUrl = `${config.ghApp.authUrl}?redirect_uri=${config.devantConsoleUrl}/ghapp&client_id=${config.ghApp.clientId}&state=${state}`;
                result = {
                    requiresAuth: true,
                    authorizationUrl: authUrl,
                    message: "GitHub authorization is required. Please click the link to complete the authorization flow, then retry creating the integration.",
                };
            } else {
                // GitHub connected but this specific repo is not accessible — install/grant flow
                const installUrl = `${config.ghApp.installUrl}?state=${state}`;
                result = {
                    requiresAuth: true,
                    authorizationUrl: installUrl,
                    message: "GitHub App access to this repository is required. Please click the link to grant access, then retry creating the integration.",
                };
            }
        } else {
            // Non-GitHub: direct user to credentials settings
            const credentialsUrl = `${config.devantConsoleUrl}/organizations/${input.orgHandle}/settings/credentials`;
            result = {
                requiresAuth: true,
                authorizationUrl: credentialsUrl,
                message: `Repository credentials are required. Please click the link to configure them in the Devant console, then retry creating the integration.`,
            };
        }

        console.log(`[${DEVANT_CREATE_INTEGRATION_TOOL}] Auth required for repo "${input.repoUrl}"`);

        eventHandler({
            type: "tool_result",
            toolName: DEVANT_CREATE_INTEGRATION_TOOL,
            toolOutput: result,
            toolCallId,
        });

        return result;
    }

    // 5. Verify the branch is accessible in the remote repo
    const accessibleBranches = await ext.clients.rpcClient.getRepoBranches({
        orgId,
        repoUrl: input.repoUrl,
        credRef: input.credentialId ?? "",
    });
    if (!accessibleBranches.includes(input.branch)) {
        const result: DevantCreateIntegrationResult = {
            requiresAuth: false,
            message: `Branch "${input.branch}" was not found in the remote repository "${input.repoUrl}". Available branches: ${accessibleBranches.length ? accessibleBranches.join(", ") : "(none accessible)"}. Please push the branch to the remote or choose an existing branch and retry.`,
        };
        console.log(`[${DEVANT_CREATE_INTEGRATION_TOOL}] Branch "${input.branch}" not accessible in "${input.repoUrl}"`);
        eventHandler({
            type: "tool_result",
            toolName: DEVANT_CREATE_INTEGRATION_TOOL,
            toolOutput: result,
            toolCallId,
        });
        return result;
    }

    // 6. Create the component
    const mappedType = getTypeOfIntegrationType(input.integrationType);

    let buildPackLang: string;
    if (StateMachine.getContext().projectType === ProjectType.BI_BALLERINA) {
        buildPackLang = "ballerina";
    } else if (StateMachine.getContext().projectType === ProjectType.MI) {
        buildPackLang = "microintegrator";
    } else {
        throw new Error("Please ensure that you are within a valid Ballerina or MI project to deploy an integration in the cloud");
    }

    const component = await ext.clients.rpcClient.createComponent({
        orgId,
        orgUUID: org.uuid,
        projectId: project.id,
        projectHandle: project.handler,
        name: makeURLSafe(input.componentName),
        displayName: input.componentName,
        type: mappedType.type,
        componentSubType: mappedType.subType ?? "",
        buildPackLang,
        componentDir: input.componentDir,
        repoUrl: input.repoUrl,
        gitProvider,
        gitCredRef: input.credentialId ?? "",
        branch: input.branch,
        langVersion: "",
        port: 0,
        spaBuildCommand: "",
        spaNodeVersion: "",
        spaOutputDir: "",
    });

    console.log(`[${DEVANT_CREATE_INTEGRATION_TOOL}] Created integration "${component.metadata.displayName}" (${component.metadata.id})`);

    // 6. Update context file so the workspace reflects the newly created integration
    try {
        const gitRoot = await getGitRoot(ext.context, input.componentDir);
        updateContextFileUtil(gitRoot, userInfo, project, org, projects);
        await contextStore.getState().refreshState();
    } catch (err) {
        console.warn(`[${DEVANT_CREATE_INTEGRATION_TOOL}] Failed to update context file after creation: ${err}`);
    }
    const result: DevantCreateIntegrationResult = { requiresAuth: false, component };

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_CREATE_INTEGRATION_TOOL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createDevantCreateIntegrationTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Creates a new WSO2 integration component in the currently associated Devant project.

**Purpose:**
Registers a new integration in Devant by linking a git repository directory to a project. Supports all Devant integration types: Integration as API, Automation, Event Integration, File Integration, and AI Agent.

When the user says they want to **"deploy"**, **"deploy to Devant"**, **"deploy to the cloud"**, **"create a component"**, or **"create an integration"** — they all mean the same thing: call this tool. Once an integration is created in Devant, it automatically builds and deploys from the remote repo.

**Prerequisites:**
1. Call DevantGetWorkspaceContextTool first. Use \`selectedOrg.id\` as \`orgId\`, \`selectedOrg.handle\` as \`orgHandle\`, and \`selectedProject.handler\` as \`projectHandler\`. If \`isAssociated\` is false (selectedOrg or selectedProject is null), call DevantListOrgsTool and DevantListProjectsTool to let the user pick, then call DevantAssociateWorkspaceTool before proceeding.
2. **Ensure all changes are committed and pushed to the remote repository.** Devant automatically starts a build from the remote repo immediately after the integration is created — if the source is not in the remote, the build will fail. Verify by running \`git status\` and \`git log origin/<branch>..<branch>\`. If there are unpushed commits or uncommitted changes, inform the user and wait for them to push before proceeding.
3. Call **DevantGetGitInfoTool** (optionally passing \`directoryPath\` if the integration is not at the workspace root). Use the result to:
   - Confirm \`isGitInitialized\` is true — if false, stop and inform the user that the workspace is not a git repository.
   - Confirm \`remotes\` is non-empty — if empty, stop and inform the user that a remote must be configured and the code pushed before deploying.
   - Use the \`fetchUrl\` of the \`origin\` remote (or the first remote if \`origin\` is absent) as \`repoUrl\`. Strip any embedded credentials and the \`.git\` suffix.
   - Use \`branch\` as the \`branch\` value, but confirm with the user if they want to deploy from a different branch. If \`branch\` is undefined (detached HEAD), ask the user which branch to use.
4. Derive \`componentName\` from source (see rules below) — do NOT ask the user.
5. Analyze the workspace source code to determine \`integrationType\` automatically (see detection rules below) — do NOT ask the user.
6. For **non-GitHub repos** (Bitbucket, GitLab), resolve the credential before calling this tool:
   - Call DevantGetCredentialsTool to list all credentials for the org.
   - Present the list to the user and ask them to pick the correct one for the repo.
   - Pass the selected credential's \`id\` as \`credentialId\`.
   - For **GitLab** repos specifically: also call DevantGetCredentialDetailsTool with the selected credential to retrieve its \`serverUrl\`. Construct the full \`repoUrl\` as \`{serverUrl}/{gitOrg}/{repoName}\` (e.g. \`https://gitlab.example.com/acme/payments\`).

**Check for existing integration (do this before creating):**
1. Call DevantListIntegrationsTool with \`{ orgId, orgHandle, projectId: selectedProject.id, projectHandler: selectedProject.handler, directoryPath: workspaceFolderPath }\` where \`workspaceFolderPath\` is the value returned by DevantGetGitInfoTool — do NOT construct or guess this path. Passing \`directoryPath\` scopes the result to integrations already registered for that exact local directory, so no manual source path comparison is needed.
2. If the result is non-empty, **warn the user** with a message like: "An integration for this directory already exists in the project (\`<existing-component-name>\`). Do you want to create another one?" and **wait for explicit confirmation** before proceeding.
3. If the result is empty, no duplicate exists — proceed to derive \`componentName\` using the full project-wide list for uniqueness checks: call DevantListIntegrationsTool again without \`directoryPath\` to get all component names.

**How to determine componentName:**
1. Use the basename of the integration's full filesystem path (e.g. if \`componentDir\` is \`/Users/foo/projects/my-repo/services/payment-processor\`, the name is \`payment-processor\`).
2. Using the component list already fetched above, compare the derived name (lowercased) against existing component \`metadata.name\` values (lowercased).
3. If the name already exists, append \`-1\`, \`-2\`, etc. until the name is unique (e.g. \`payment-processor-1\`).
4. Pass the final name as \`componentName\`.

**How to determine integrationType from source code:**

For **Ballerina** projects, read the \`.bal\` files in the component directory and inspect their \`import\` statements and entry-point annotations:
- \`import ballerina/http\`, \`ballerina/graphql\`, or \`ballerina/tcp\` → \`integration-as-api\`
- \`import ballerinax/kafka\`, \`ballerinax/rabbitmq\`, \`ballerinax/salesforce\`, \`ballerinax/trigger.github\`, \`ballerinax/mqtt\`, or \`ballerinax/asb\` → \`event-integration\`
- \`import ballerinax/ftp\` or \`ballerina/file\` → \`file-integration\`
- \`import ballerinax/ai\` or any AI/LLM module → \`ai-agent\`
- \`@task:TimerConfig\` or \`@task:AppointmentConfig\` annotation on an entry point → \`automation\`

For **MI** projects, inspect the directory structure under \`src/main/synapse-config/\`:
- Files in \`api/\` → \`integration-as-api\`
- Files in \`tasks/\` → \`automation\`
- Files in \`inbound-endpoints/\` (message broker configs: Kafka, RabbitMQ, JMS, MQTT) → \`event-integration\`
- File connector usage (SFTP, FTP, S3, local filesystem connectors) in any config → \`file-integration\`
- AI/LLM connector usage (OpenAI, Azure AI, etc.) in any config → \`ai-agent\`

If multiple types are detected or the type cannot be determined from the source code, ask the user to choose from the available options before calling this tool.

**Integration types:**
- \`integration-as-api\` — Exposes an integration as a REST API (service)
- \`automation\` — Scheduled or triggered automation task
- \`event-integration\` — Reacts to events (message brokers, queues)
- \`file-integration\` — Processes files from storage
- \`ai-agent\` — AI-powered service component

**Repository Authorization:**
- GitHub repo — no GitHub access granted: returns \`authorizationUrl\` for GitHub OAuth. Present as a clickable link, then retry.
- GitHub repo — connected but this repo not accessible: returns \`authorizationUrl\` for GitHub App install. Present as a clickable link, then retry.
- Bitbucket or GitLab repo — credential provided but still not accessible: returns \`authorizationUrl\` pointing to Devant credentials settings. Present as a clickable link so the user can reconfigure the credential, then retry.

**Response Format:**
- \`requiresAuth: false\` + \`component\` — integration created successfully; Devant has started building it from the remote repo. Immediately call DevantGetIntegrationConsoleUrlTool with \`component.metadata.handler\` and present the URL as a clickable link so the user can monitor the build and deployment. If the build succeeds, it will be automatically deployed in Devant.
- \`requiresAuth: false\` + \`message\` (no \`component\`) — a pre-flight check failed (e.g. the branch does not exist in the remote). Present the message to the user and do not proceed.
- \`requiresAuth: true\` + \`message\` + \`authorizationUrl\` — authorization needed; present the message and include the URL as a clickable link for the user

**Examples:**
User: "Deploy this integration to Devant" (GitHub repo)
→ DevantGetWorkspaceContextTool → isAssociated: true → extract orgId, orgHandle, projectId, projectHandler
→ Verify git status and push — all changes must be in the remote before proceeding
→ DevantGetGitInfoTool → confirm isGitInitialized + remotes non-empty → extract repoUrl (origin fetchUrl) and branch
→ Analyze workspace source files to determine integrationType
→ DevantListIntegrationsTool with { orgId, orgHandle, projectId, projectHandler, directoryPath: workspaceFolderPath } → check for duplicate → warn + confirm if found → DevantListIntegrationsTool without directoryPath → derive unique componentName
→ DevantCreateIntegrationTool with { orgId, orgHandle, projectHandler, componentName, integrationType, repoUrl, branch }
→ DevantGetIntegrationConsoleUrlTool with { orgHandle, projectId, componentHandler: component.metadata.handler } → present URL to user

User: "Deploy this integration to Devant" (GitLab repo)
→ DevantGetWorkspaceContextTool → isAssociated: true → extract orgId, orgHandle, projectId, projectHandler
→ Verify git status and push — all changes must be in the remote before proceeding
→ DevantGetGitInfoTool → confirm isGitInitialized + remotes non-empty → extract branch
→ Analyze workspace source files to determine integrationType
→ DevantListIntegrationsTool with { orgId, orgHandle, projectId, projectHandler, directoryPath: workspaceFolderPath } → check for duplicate → warn + confirm if found → DevantListIntegrationsTool without directoryPath → derive unique componentName
→ DevantGetCredentialsTool with { orgId, orgHandle } → present list to user, user picks credential
→ DevantGetCredentialDetailsTool with { orgId, orgHandle, credentialId } → get serverUrl → construct repoUrl
→ DevantCreateIntegrationTool with { orgId, orgHandle, projectHandler, componentName, integrationType, repoUrl, branch, credentialId }
→ DevantGetIntegrationConsoleUrlTool with { orgHandle, projectId, componentHandler: component.metadata.handler } → present URL to user
`,
        inputSchema: DevantCreateIntegrationSchema,
        execute: async (input: DevantCreateIntegrationInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_CREATE_INTEGRATION_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantCreateIntegration(eventHandler, toolCallId, input);
        },
    });
}
