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

import * as vscode from "vscode";
import { tool, jsonSchema } from "ai";
import { DevantToolEventHandler, Project } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { contextStore } from "../../../cloud/stores/context-store";
import { dataCacheStore } from "../../../cloud/stores/data-cache-store";
import { updateContextFile as updateContextFileUtil } from "../../../cloud/cmds/create-directory-context-cmd";
import { getGitRoot } from "../../../cloud/git/util";

export const DEVANT_CREATE_PROJECT_TOOL = "DevantCreateProjectTool";

export interface DevantCreateProjectInput {
    orgId: string;
    orgHandler: string;
    projectName: string;
}

const DevantCreateProjectSchema = jsonSchema<DevantCreateProjectInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: "The numeric ID of the organization to create the project in. Obtain from DevantListOrgsTool.",
        },
        orgHandler: {
            type: "string",
            description: "The handle (slug) of the organization. Obtain from DevantListOrgsTool.",
        },
        projectName: {
            type: "string",
            description: "The name for the new Devant project.",
        },
    },
    required: ["orgId", "orgHandler", "projectName"],
});

export async function devantCreateProject(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantCreateProjectInput,
): Promise<Project> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_CREATE_PROJECT_TOOL,
        toolInput: input,
        toolCallId,
    });

    const region = ext.authProvider?.getState().state?.region ?? "US";

    const project = await ext.clients.rpcClient.createProject({
        orgId: input.orgId,
        orgHandler: input.orgHandler,
        projectName: input.projectName,
        region,
    });

    console.log(`[${DEVANT_CREATE_PROJECT_TOOL}] Created project: ${project.name} (${project.id})`);

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
        try {
            const userInfo = ext.authProvider?.getState().state?.userInfo;
            const org = userInfo?.organizations?.find((o) => o.handle === input.orgHandler);
            if (userInfo && org) {
                const projectList = dataCacheStore.getState().getProjects(input.orgHandler);
                const gitRoot = await getGitRoot(ext.context, workspacePath);
                if (gitRoot) {
                    updateContextFileUtil(gitRoot, userInfo, project, org, projectList);
                    await contextStore.getState().refreshState();
                    console.log(`[${DEVANT_CREATE_PROJECT_TOOL}] Workspace associated with project and state refreshed`);
                }
            }
        } catch (err) {
            console.error(`[${DEVANT_CREATE_PROJECT_TOOL}] Failed to update context file or refresh state: ${err}`);
        }
    }

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_CREATE_PROJECT_TOOL,
        toolOutput: project,
        toolCallId,
    });

    return project;
}

export function createDevantCreateProjectTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Creates a new project in the Devant platform under a specified organization.

**Purpose:**
Creates a new Devant project that can then be used to group related components (services, integrations, tasks).
After creation, the current workspace is automatically associated with the new project.

**When to use this tool:**
- When the user explicitly asks to create a new Devant project

**How to obtain the required inputs — follow these steps in order:**
1. Call DevantGetWorkspaceContextTool first.
2. For orgId and orgHandler:
   - If selectedOrg is non-null, use selectedOrg.id and selectedOrg.handle — do not ask the user
   - If selectedOrg is null, call DevantListOrgsTool, present the list, and use the chosen org's id and handle
3. Ask the user for the project name if not already provided.

**Response Format:**
Returns the created project object containing:
- id: Unique project identifier
- name: Project name
- handler: Project handle (URL-friendly name)
- region: Cloud region the project was created in

After creation, the current workspace is automatically associated with the new project (context file updated and state refreshed).

**Example:**
User: "Create a new project called Payment Service"
→ DevantGetWorkspaceContextTool → selectedOrg is non-null
→ DevantCreateProjectTool with { orgId: selectedOrg.id, orgHandler: selectedOrg.handle, projectName: "Payment Service" }
`,
        inputSchema: DevantCreateProjectSchema,
        execute: async (input: DevantCreateProjectInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_CREATE_PROJECT_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantCreateProject(eventHandler, toolCallId, input);
        },
    });
}
