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
 * WSO2 Cloud platform knowledge for AI agents.
 * Exported via ExtensionExports.ai.getCloudKnowledge so other
 * extensions (e.g. ballerina-extension) can include it in their
 * system prompts without duplicating content.
 */

import { WI_CLOUD_AGENT_TOOL_NAMES } from "./tools/cloud/cloud-tool-names";

export function getCloudKnowledge(): string {
   return `
# WSO2 Cloud Platform Knowledge

## Platform Concepts

### Organization (Org)
The top-level container in WSO2 Cloud. Every resource (project, integration, credential) belongs to an org.
- Identifier fields: \`id\` (numeric), \`handle\` (slug, URL-safe name)
- Obtain from: \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\` (selectedOrg) or \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}\`

### Project
A logical grouping of integrations (components) within an org. Maps to a single Git repository or a mono-repo.
- Identifier fields: \`id\` (UUID), \`handler\` (slug)
- Obtain from: \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\` (selectedProject) or \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}\`

### Environment
Each WSO2 Cloud project has environments (e.g. Development, Production) where integrations are deployed.
- Obtain from: \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_PROJECT_ENVS}\`

### Integration (Component)
An integration is a deployable unit in WSO2 Cloud — a service, automation, or scheduled task hosted in the platform.
The local workspace folder (or a subdirectory) corresponds to one integration pushed to WSO2 Cloud.
- Identifier fields: \`metadata.id\` (UUID), \`metadata.name\`, \`metadata.handler\`
- Obtain from: \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}\` or \`${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION}\` result

### Connections
WSO2 Cloud supports three types of connections for integrations:
- **Internal (component-to-component)**: connects one WSO2 Cloud integration to another within the same project
- **Third-party**: connects to an external SaaS API (e.g. Salesforce, GitHub)
- **Database**: connects to a managed database service

### Credentials
Credentials (OAuth clients, API keys, etc.) allow integrations to authenticate against external or internal services.
- Obtain list: \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIALS}\`
- Obtain details: \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIAL_DETAILS}\`

### Config Variables & Secrets
WSO2 Cloud allows storing runtime configuration (environment variables) and secrets per environment.
These are injected into the integration at deploy time.

---

## Available WSO2 Cloud Tools

### ${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}
Returns git information for the workspace: \`isGitInitialized\`, \`workspaceFolderPath\`, \`rootPath\`, \`remotes\`, \`branch\`, \`commit\`.
**CRITICAL**: \`workspaceFolderPath\` is the ground-truth filesystem path for this workspace.
Always pass \`workspaceFolderPath\` directly as \`directoryPath\` to other tools. Never construct or guess this path.

### ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}
Returns the WSO2 Cloud org and project currently associated with the workspace folder (\`selectedOrg\`, \`selectedProject\`, \`isAssociated\`).
Call this early — most other tools require \`orgId\`, \`orgHandle\`, \`projectId\`, and \`projectHandler\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}
Lists all organizations the current user belongs to in WSO2 Cloud.
Use when \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\` returns \`isAssociated: false\` and you need to let the user pick an org.

### ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}
Lists all projects in a given organization.
Use when you need to let the user pick a project or when the workspace is not yet associated.
Input: \`orgId\` (from ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} or ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}).

### ${WI_CLOUD_AGENT_TOOL_NAMES.ASSOCIATE_WORKSPACE}
Associates the current workspace folder with a specific WSO2 Cloud org and project.
Must be called before \`${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION}\` if the workspace is not yet associated.
Inputs: \`orgId\`, \`orgHandle\`, \`projectHandler\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT}
Creates a new project in a given WSO2 Cloud organization.
Inputs: \`orgId\`, \`orgHandle\`, \`projectName\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.GET_PROJECT_ENVS}
Returns the list of environments (e.g. Development, Production) for a project.
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}
Lists integrations (components) in a project.
- Without \`directoryPath\`: fetches all components via RPC
- With \`directoryPath\` (pass \`workspaceFolderPath\` from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}): filters from local context store to only return integrations associated with that local directory. Prefer this form to narrow results.
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`, \`projectHandler\`, optionally \`directoryPath\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION}
Pushes the local workspace as a new WSO2 Cloud integration (component).
Prerequisites:
1. Call \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}\` — verify git is initialized and capture \`workspaceFolderPath\`, \`remotes\`, \`branch\`
2. Confirm the workspace is associated (\`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\`)
3. Check for duplicates using \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}\` with \`directoryPath: workspaceFolderPath\`
4. The tool validates branch accessibility via \`getRepoBranches\` before calling \`createComponent\`
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`, \`projectHandler\`, \`componentName\`, \`repoUrl\`, \`branch\`, \`componentDir\` (workspaceFolderPath), \`integrationType\`, optionally \`credentialId\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.DELETE_INTEGRATION}
Permanently deletes a WSO2 Cloud integration and cleans up local context cache.
**WARNING**: Irreversible. Always confirm with the user before calling.
Prerequisites: call \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}\` to resolve \`componentId\`, \`componentName\`, \`projectHandler\`.
Inputs: \`orgId\`, \`orgHandle\`, \`projectId\`, \`projectHandler\`, \`componentId\`, \`componentName\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIALS}
Lists credentials (OAuth clients, API keys, etc.) available for an organization.
Inputs: \`orgId\`, \`orgHandle\`.

### ${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIAL_DETAILS}
Returns full details of a specific credential including its type and configuration fields.
Inputs: \`orgId\`, \`orgHandle\`, \`credentialId\` (from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIALS}).

### ${WI_CLOUD_AGENT_TOOL_NAMES.GET_INTEGRATION_CONSOLE_URL}
Returns the WSO2 Cloud web console URL for a specific integration (component).
Use to give the user a direct link to their integration in the WSO2 Cloud portal.
Inputs: \`orgHandle\`, \`projectId\`, \`componentHandler\` (metadata.handler from ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}).

### ${WI_CLOUD_AGENT_TOOL_NAMES.OPEN_CONSOLE}
Opens the WSO2 Cloud web console in the default browser.
Use when the user wants to navigate to the WSO2 Cloud portal for tasks not covered by other tools (e.g. manage team, billing, deploy settings).
Inputs: \`task\` (short description), optionally \`orgHandle\`, \`projectId\`.

---

## Tool Usage Guidelines

1. **Start with git + workspace context**
   Call \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}\` then \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\` at the beginning of any WSO2 Cloud workflow.
   The \`workspaceFolderPath\` returned by \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}\` is the canonical local path — always use it directly, never guess or construct a path.

2. **Associate before creating**
   If \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\` returns \`isAssociated: false\`, call \`${WI_CLOUD_AGENT_TOOL_NAMES.ASSOCIATE_WORKSPACE}\` before \`${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION}\`.

3. **Narrow integration lists**
   Pass \`directoryPath: workspaceFolderPath\` to \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}\` to filter to just the current workspace directory instead of fetching all project integrations.

4. **Check duplicates before creating**
   Before calling \`${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION}\`, use \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}\` with \`directoryPath: workspaceFolderPath\` to confirm no integration already exists for the same directory.

5. **Confirm before destructive operations**
   Always get explicit user confirmation before calling \`${WI_CLOUD_AGENT_TOOL_NAMES.DELETE_INTEGRATION}\`.

6. **Parameter sourcing**
   - \`orgId\`, \`orgHandle\`: from \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\` or \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}\`
   - \`projectId\`, \`projectHandler\`: from \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}\` or \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}\`
   - \`componentId\`, \`componentHandler\`: from \`${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}\` or \`${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION}\` result
   - \`repoUrl\`, \`branch\`: from \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}\` (remotes[0].url, branch)
   - \`directoryPath\`: always use \`workspaceFolderPath\` from \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}\`, never construct

7. **Console URL vs open console**
   Use \`${WI_CLOUD_AGENT_TOOL_NAMES.GET_INTEGRATION_CONSOLE_URL}\` to get and display a URL inline.
   Use \`${WI_CLOUD_AGENT_TOOL_NAMES.OPEN_CONSOLE}\` when you need to open the browser for a general WSO2 Cloud task.
`;
}
