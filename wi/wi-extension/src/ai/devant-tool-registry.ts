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
 * Devant AI tool registry factory for wi-extension.
 * Exports generic Devant platform tools that can be consumed by other
 * extensions (e.g. ballerina-extension) via the ExtensionExports.ai API.
 */
import { DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { createDevantGetWorkspaceContextTool, DEVANT_GET_WORKSPACE_CONTEXT_TOOL } from "./tools/devant/devant-get-workspace-context";
import { createDevantListOrgsTool, DEVANT_LIST_ORGS_TOOL } from "./tools/devant/devant-list-orgs";
import { createDevantListProjectsTool, DEVANT_LIST_PROJECTS_TOOL } from "./tools/devant/devant-list-projects";
import { createDevantAssociateWorkspaceTool, DEVANT_ASSOCIATE_WORKSPACE_TOOL } from "./tools/devant/devant-associate-workspace";
import { createDevantCreateProjectTool, DEVANT_CREATE_PROJECT_TOOL } from "./tools/devant/devant-create-project";
import { createDevantGetProjectEnvsTool, DEVANT_GET_PROJECT_ENVS_TOOL } from "./tools/devant/devant-get-project-envs";
import { createDevantOpenConsoleTool, DEVANT_OPEN_CONSOLE_TOOL } from "./tools/devant/devant-open-console";
import { createDevantCreateIntegrationTool, DEVANT_CREATE_INTEGRATION_TOOL } from "./tools/devant/devant-create-integration";
import { createDevantListIntegrationsTool, DEVANT_LIST_INTEGRATIONS_TOOL } from "./tools/devant/devant-list-integrations";
import { createDevantGetCredentialsTool, DEVANT_GET_CREDENTIALS_TOOL } from "./tools/devant/devant-get-credentials";
import { createDevantGetCredentialDetailsTool, DEVANT_GET_CREDENTIAL_DETAILS_TOOL } from "./tools/devant/devant-get-credential-details";
import { createDevantGetIntegrationConsoleUrlTool, DEVANT_GET_INTEGRATION_CONSOLE_URL_TOOL } from "./tools/devant/devant-get-integration-console-url";
import { createDevantGetGitInfoTool, DEVANT_GET_GIT_INFO_TOOL } from "./tools/devant/devant-get-git-info";
import { createDevantDeleteIntegrationTool, DEVANT_DELETE_INTEGRATION_TOOL } from "./tools/devant/devant-delete-integration";
import { createDevantListMarketplaceServicesTool, DEVANT_LIST_MARKETPLACE_SERVICES_TOOL } from "./tools/devant/devant-list-marketplace-services";

export function createDevantToolRegistry(eventHandler: DevantToolEventHandler) {
    return {
        [DEVANT_GET_WORKSPACE_CONTEXT_TOOL]: createDevantGetWorkspaceContextTool(eventHandler),
        [DEVANT_LIST_ORGS_TOOL]: createDevantListOrgsTool(eventHandler),
        [DEVANT_LIST_PROJECTS_TOOL]: createDevantListProjectsTool(eventHandler),
        [DEVANT_ASSOCIATE_WORKSPACE_TOOL]: createDevantAssociateWorkspaceTool(eventHandler),
        [DEVANT_CREATE_PROJECT_TOOL]: createDevantCreateProjectTool(eventHandler),
        [DEVANT_GET_PROJECT_ENVS_TOOL]: createDevantGetProjectEnvsTool(eventHandler),
        [DEVANT_OPEN_CONSOLE_TOOL]: createDevantOpenConsoleTool(eventHandler),
        [DEVANT_CREATE_INTEGRATION_TOOL]: createDevantCreateIntegrationTool(eventHandler),
        [DEVANT_LIST_INTEGRATIONS_TOOL]: createDevantListIntegrationsTool(eventHandler),
        [DEVANT_GET_CREDENTIALS_TOOL]: createDevantGetCredentialsTool(eventHandler),
        [DEVANT_GET_CREDENTIAL_DETAILS_TOOL]: createDevantGetCredentialDetailsTool(eventHandler),
        [DEVANT_GET_INTEGRATION_CONSOLE_URL_TOOL]: createDevantGetIntegrationConsoleUrlTool(eventHandler),
        [DEVANT_GET_GIT_INFO_TOOL]: createDevantGetGitInfoTool(eventHandler),
        [DEVANT_DELETE_INTEGRATION_TOOL]: createDevantDeleteIntegrationTool(eventHandler),
        [DEVANT_LIST_MARKETPLACE_SERVICES_TOOL]: createDevantListMarketplaceServicesTool(eventHandler),
    };
}

export type DevantToolRegistry = ReturnType<typeof createDevantToolRegistry>;
