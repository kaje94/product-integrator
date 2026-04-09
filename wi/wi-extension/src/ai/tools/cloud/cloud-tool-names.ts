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
 * Centralized definitions for all WSO2 Cloud AI tool names.
 * Used in descriptions and registry to avoid hardcoding tool name strings.
 */

export const WI_CLOUD_AGENT_TOOL_NAMES = {
    GET_WORKSPACE_CONTEXT: "CloudGetWorkspaceContextTool",
    LIST_ORGS: "CloudListOrgsTool",
    LIST_PROJECTS: "CloudListProjectsTool",
    ASSOCIATE_WORKSPACE: "CloudAssociateWorkspaceTool",
    CREATE_PROJECT: "CloudCreateProjectTool",
    GET_PROJECT_ENVS: "CloudGetProjectEnvsTool",
    OPEN_CONSOLE: "CloudOpenConsoleTool",
    CREATE_INTEGRATION: "CloudCreateIntegrationTool",
    LIST_INTEGRATIONS: "CloudListIntegrationsTool",
    GET_CREDENTIALS: "CloudGetCredentialsTool",
    GET_CREDENTIAL_DETAILS: "CloudGetCredentialDetailsTool",
    GET_INTEGRATION_CONSOLE_URL: "CloudGetIntegrationConsoleUrlTool",
    GET_GIT_INFO: "CloudGetGitInfoTool",
    DELETE_INTEGRATION: "CloudDeleteIntegrationTool",
    LIST_MARKETPLACE_SERVICES: "CloudListMarketplaceServicesTool",
}