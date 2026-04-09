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
 * WSO2 Cloud AI tool registry factory for wi-extension.
 * Exports generic WSO2 Cloud platform tools that can be consumed by other
 * extensions (e.g. ballerina-extension) via the ExtensionExports.ai API.
 */
import { DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./tools/cloud/cloud-tool-names";
import { createCloudGetWorkspaceContextTool } from "./tools/cloud/cloud-get-workspace-context";
import { createCloudListOrgsTool } from "./tools/cloud/cloud-list-orgs";
import { createCloudListProjectsTool } from "./tools/cloud/cloud-list-projects";
import { createCloudAssociateWorkspaceTool } from "./tools/cloud/cloud-associate-workspace";
import { createCloudCreateProjectTool } from "./tools/cloud/cloud-create-project";
import { createCloudGetProjectEnvsTool } from "./tools/cloud/cloud-get-project-envs";
import { createCloudOpenConsoleTool } from "./tools/cloud/cloud-open-console";
import { createCloudCreateIntegrationTool } from "./tools/cloud/cloud-create-integration";
import { createCloudListIntegrationsTool } from "./tools/cloud/cloud-list-integrations";
import { createCloudGetCredentialsTool } from "./tools/cloud/cloud-get-credentials";
import { createCloudGetCredentialDetailsTool } from "./tools/cloud/cloud-get-credential-details";
import { createCloudGetIntegrationConsoleUrlTool } from "./tools/cloud/cloud-get-integration-console-url";
import { createCloudGetGitInfoTool } from "./tools/cloud/cloud-get-git-info";
import { createCloudDeleteIntegrationTool } from "./tools/cloud/cloud-delete-integration";
import { createCloudListMarketplaceServicesTool } from "./tools/cloud/cloud-list-marketplace-services";

export function createCloudToolRegistry(eventHandler: DevantToolEventHandler) {
    return {
        [WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT]: createCloudGetWorkspaceContextTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS]: createCloudListOrgsTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS]: createCloudListProjectsTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.ASSOCIATE_WORKSPACE]: createCloudAssociateWorkspaceTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT]: createCloudCreateProjectTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.GET_PROJECT_ENVS]: createCloudGetProjectEnvsTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.OPEN_CONSOLE]: createCloudOpenConsoleTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION]: createCloudCreateIntegrationTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS]: createCloudListIntegrationsTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIALS]: createCloudGetCredentialsTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIAL_DETAILS]: createCloudGetCredentialDetailsTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.GET_INTEGRATION_CONSOLE_URL]: createCloudGetIntegrationConsoleUrlTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO]: createCloudGetGitInfoTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.DELETE_INTEGRATION]: createCloudDeleteIntegrationTool(eventHandler),
        [WI_CLOUD_AGENT_TOOL_NAMES.LIST_MARKETPLACE_SERVICES]: createCloudListMarketplaceServicesTool(eventHandler),
    };
}

export type CloudToolRegistry = ReturnType<typeof createCloudToolRegistry>;
