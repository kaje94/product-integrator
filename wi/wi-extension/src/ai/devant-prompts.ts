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

/**
 * Devant platform knowledge for AI agents.
 * Exported via ExtensionExports.ai.getDevantKnowledge so other
 * extensions (e.g. ballerina-extension) can include it in their
 * system prompts without duplicating content.
 */

export function getDevantKnowledge(): string {
   return `
# Devant Platform Knowledge

## Platform Concepts

### Organization (Org)
The top-level container in Devant. Every resource (project, integration, credential) belongs to an org.
- Identifier fields: \`id\` (numeric), \`handle\` (slug, URL-safe name)
- Obtain from: \`DevantGetWorkspaceContextTool\` (selectedOrg) or \`DevantListOrgsTool\`

### Project
A logical grouping of integrations (components) within an org. Maps to a single Git repository or a mono-repo.
- Identifier fields: \`id\` (UUID), \`handler\` (slug)
- Obtain from: \`DevantGetWorkspaceContextTool\` (selectedProject) or \`DevantListProjectsTool\`

### Environment
Each Devant project has environments (e.g. Development, Production) where integrations are deployed.
- Obtain from: \`DevantGetProjectEnvsTool\`

### Integration (Component)
An integration is a deployable unit in Devant — a service, automation, or scheduled task hosted in the platform.
The local workspace folder (or a subdirectory) corresponds to one integration pushed to Devant.
- Identifier fields: \`metadata.id\` (UUID), \`metadata.name\`, \`metadata.handler\`
- Obtain from: \`DevantListIntegrationsTool\` or \`DevantCreateIntegrationTool\` result

### Connections
Devant supports three types of connections for integrations:
- **Internal (component-to-component)**: connects one Devant integration to another within the same project
- **Third-party**: connects to an external SaaS API (e.g. Salesforce, GitHub)
- **Database**: connects to a managed database service

### Credentials
Credentials (OAuth clients, API keys, etc.) allow integrations to authenticate against external or internal services.
- Obtain list: \`DevantGetCredentialsTool\`
- Obtain details: \`DevantGetCredentialDetailsTool\`

### Config Variables & Secrets
Devant allows storing runtime configuration (environment variables) and secrets per environment.
These are injected into the integration at deploy time.

---

## Available Devant Tools

### DevantGetGitInfoTool
Returns git information for the workspace: \`isGitInitialized\`, \`workspaceFolderPath\`, \`rootPath\`, \`remotes\`, \`branch\`, \`commit\`.
**CRITICAL**: \`workspaceFolderPath\` is the ground-truth filesystem path for this workspace.
Always pass \`workspaceFolderPath\` directly as \`directoryPath\` to other tools. Never construct or guess this path.

### DevantGetWorkspaceContextTool
Returns the Devant org and project currently associated with the workspace folder (\`selectedOrg\`, \`selectedProject\`, \`isAssociated\`).
Call this early — most other tools require \`orgId\`, \`orgHandle\`, \`projectId\`, and \`projectHandler\`.

### DevantListOrgsTool
Lists all organizations the current user belongs to in Devant.
Use when \`DevantGetWorkspaceContextTool\` returns \`isAssociated: false\` and you need to let the user pick an org.

### DevantListProjectsTool
Lists all projects in a given organization.
Use when you need to let the user pick a project or when the workspace is not yet associated.
Input: \`orgId\` (from DevantListOrgsTool or DevantGetWorkspaceContextTool).

### DevantAssociateWorkspaceTool
Associates the current workspace folder with a specific Devant org and project.
Must be called before \`DevantCreateIntegrationTool\` if the workspace is not yet associated.
Inputs: \`orgId\`, \`orgHandle\`, \`projectHandler\`.

### DevantCreateProjectTool
Creates a new project in a given Devant organization.
Inputs: \`orgId\`, \`orgHandle\`, \`projectName\`.

### DevantGetProjectEnvsTool
Returns the list of environments (e.g. Development, Production) for a project.
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`.

### DevantListIntegrationsTool
Lists integrations (components) in a project.
- Without \`directoryPath\`: fetches all components via RPC
- With \`directoryPath\` (pass \`workspaceFolderPath\` from DevantGetGitInfoTool): filters from local context store to only return integrations associated with that local directory. Prefer this form to narrow results.
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`, \`projectHandler\`, optionally \`directoryPath\`.

### DevantCreateIntegrationTool
Pushes the local workspace as a new Devant integration (component).
Prerequisites:
1. Call \`DevantGetGitInfoTool\` — verify git is initialized and capture \`workspaceFolderPath\`, \`remotes\`, \`branch\`
2. Confirm the workspace is associated (\`DevantGetWorkspaceContextTool\`)
3. Check for duplicates using \`DevantListIntegrationsTool\` with \`directoryPath: workspaceFolderPath\`
4. The tool validates branch accessibility via \`getRepoBranches\` before calling \`createComponent\`
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`, \`projectHandler\`, \`componentName\`, \`repoUrl\`, \`branch\`, \`componentDir\` (workspaceFolderPath), \`integrationType\`, optionally \`credentialId\`.

### DevantDeleteIntegrationTool
Permanently deletes a Devant integration and cleans up local context cache.
**WARNING**: Irreversible. Always confirm with the user before calling.
Prerequisites: call \`DevantListIntegrationsTool\` to resolve \`componentId\`, \`componentName\`, \`projectHandler\`.
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`, \`projectHandler\`, \`componentId\`, \`componentName\`.

### DevantGetCredentialsTool
Lists credentials (OAuth clients, API keys, etc.) available for an organization.
Inputs: \`orgId\`, \`orgHandle\`.

### DevantGetCredentialDetailsTool
Returns full details of a specific credential including its type and configuration fields.
Inputs: \`orgId\`, \`orgHandle\`, \`credentialId\` (from DevantGetCredentialsTool).

### DevantGetIntegrationConsoleUrlTool
Returns the Devant web console URL for a specific integration (component).
Use to give the user a direct link to their integration in the Devant portal.
Inputs: \`orgHandle\`, \`projectId\`, \`componentHandler\` (metadata.handler from DevantListIntegrationsTool).

### DevantOpenConsoleTool
Opens the Devant web console in the default browser.
Use when the user wants to navigate to the Devant portal for tasks not covered by other tools (e.g. manage team, billing, deploy settings).
Inputs: \`task\` (short description), optionally \`orgHandle\`, \`projectId\`.

---

## Tool Usage Guidelines

1. **Start with git + workspace context**
   Call \`DevantGetGitInfoTool\` then \`DevantGetWorkspaceContextTool\` at the beginning of any Devant workflow.
   The \`workspaceFolderPath\` returned by \`DevantGetGitInfoTool\` is the canonical local path — always use it directly, never guess or construct a path.

2. **Associate before creating**
   If \`DevantGetWorkspaceContextTool\` returns \`isAssociated: false\`, call \`DevantAssociateWorkspaceTool\` before \`DevantCreateIntegrationTool\`.

3. **Narrow integration lists**
   Pass \`directoryPath: workspaceFolderPath\` to \`DevantListIntegrationsTool\` to filter to just the current workspace directory instead of fetching all project integrations.

4. **Check duplicates before creating**
   Before calling \`DevantCreateIntegrationTool\`, use \`DevantListIntegrationsTool\` with \`directoryPath: workspaceFolderPath\` to confirm no integration already exists for the same directory.

5. **Confirm before destructive operations**
   Always get explicit user confirmation before calling \`DevantDeleteIntegrationTool\`.

6. **Parameter sourcing**
   - \`orgId\`, \`orgHandle\`: from \`DevantGetWorkspaceContextTool\` or \`DevantListOrgsTool\`
   - \`projectId\`, \`projectHandler\`: from \`DevantGetWorkspaceContextTool\` or \`DevantListProjectsTool\`
   - \`componentId\`, \`componentHandler\`: from \`DevantListIntegrationsTool\` or \`DevantCreateIntegrationTool\` result
   - \`repoUrl\`, \`branch\`: from \`DevantGetGitInfoTool\` (remotes[0].url, branch)
   - \`directoryPath\`: always use \`workspaceFolderPath\` from \`DevantGetGitInfoTool\`, never construct

7. **Console URL vs open console**
   Use \`DevantGetIntegrationConsoleUrlTool\` to get and display a URL inline.
   Use \`DevantOpenConsoleTool\` when you need to open the browser for a general Devant task.
`;
}
