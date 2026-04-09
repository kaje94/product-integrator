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

import { tool, jsonSchema } from "ai";
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";
import { ComponentKind, DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { contextStore } from "../../../cloud/stores/context-store";
import { isSamePath } from "../../../utils/pathUtils";



export interface CloudListIntegrationsInput {
    orgId: string;
    orgHandle: string;
    projectId: string;
    projectHandler: string;
    directoryPath?: string;
}

const CloudListIntegrationsSchema = jsonSchema<CloudListIntegrationsInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: `Numeric ID of the organization. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedOrg.id) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}.`,
        },
        orgHandle: {
            type: "string",
            description: `Handle (slug) of the organization. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedOrg.handle) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}.`,
        },
        projectId: {
            type: "string",
            description: `Unique ID of the project. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedProject.id) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}.`,
        },
        projectHandler: {
            type: "string",
            description: `Handler (slug) of the project. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedProject.handler) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}.`,
        },
        directoryPath: {
            type: "string",
            description: `Absolute filesystem path of the integration directory to narrow results to. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO} (workspaceFolderPath). Do NOT construct or guess this path — only use the value returned by ${WI_CLOUD_AGENT_TOOL_NAMES.GET_GIT_INFO}.`,
        },
    },
    required: ["orgId", "orgHandle", "projectId", "projectHandler"],
});

export async function cloudListIntegrations(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: CloudListIntegrationsInput,
): Promise<ComponentKind[]> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS,
        toolInput: input,
        toolCallId,
    });

    let components: ComponentKind[];

    if (input.directoryPath) {
        const cachedComponents = contextStore.getState().state?.components ?? [];
        components = cachedComponents
            .filter((item) => item.componentFsPath && isSamePath(item.componentFsPath, input.directoryPath!))
            .map((item) => item.component)
            .filter((item): item is ComponentKind => !!item);
        console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}] Filtered to ${components.length} integrations matching directory "${input.directoryPath}"`);
    } else {
        components = await ext.clients.rpcClient.getComponentList({
            orgId: input.orgId,
            orgHandle: input.orgHandle,
            projectId: input.projectId,
            projectHandle: input.projectHandler,
        });
        console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}] Returning ${components.length} integrations for project "${input.projectHandler}"`);
    }

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS,
        toolOutput: components,
        toolCallId,
    });

    return components;
}

export function createCloudListIntegrationsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves integration components in a WSO2 Cloud project, optionally scoped to a specific directory.

**Purpose:**
Returns integration components already registered in a WSO2 Cloud project. When \`directoryPath\` is provided, only integrations whose source path matches that directory are returned, which is more precise and efficient than scanning all project integrations.

**When to use this tool:**
- When the user asks to see their integrations or components
- Before creating a new integration, to check whether one already exists for the same directory — pass \`directoryPath\` to scope the check to the current workspace folder
- When you need to resolve a component name to its ID or metadata for operations like delete

**Prerequisites:**
Call ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} first to obtain \`orgId\`, \`orgHandle\`, \`projectId\`, and \`projectHandler\` from \`selectedOrg\` and \`selectedProject\`.

**Using directoryPath:**
Pass the absolute filesystem path of the integration directory. When provided, the result is filtered from the local context store using path equality — this avoids fetching all project integrations and immediately narrows to only those associated with that directory. Use this when the intent is to check or act on a specific local directory.

**Response Format:**
Returns a list of component objects, each containing:
- \`metadata.id\`: Unique component identifier
- \`metadata.name\`: URL-safe component name
- \`metadata.displayName\`: Human-readable display name
- \`metadata.handler\`: Component handle used in console URLs
- \`spec.type\`: Component type (service, scheduleTask, eventHandler, library)
- \`spec.source\`: Repository source info (repo URL, branch, path)
`,
        inputSchema: CloudListIntegrationsSchema,
        execute: async (input: CloudListIntegrationsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}] Called [toolCallId: ${toolCallId}]`);
            return await cloudListIntegrations(eventHandler, toolCallId, input);
        },
    });
}
