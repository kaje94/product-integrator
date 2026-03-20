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
import { ComponentKind, DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { contextStore } from "../../../cloud/stores/context-store";
import { isSamePath } from "../../../utils/pathUtils";

export const DEVANT_LIST_INTEGRATIONS_TOOL = "DevantListIntegrationsTool";

export interface DevantListIntegrationsInput {
    orgId: string;
    orgHandle: string;
    projectId: string;
    projectHandler: string;
    directoryPath?: string;
}

const DevantListIntegrationsSchema = jsonSchema<DevantListIntegrationsInput>({
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
        projectId: {
            type: "string",
            description: "Unique ID of the project. Obtain from DevantGetWorkspaceContextTool (selectedProject.id) or DevantListProjectsTool.",
        },
        projectHandler: {
            type: "string",
            description: "Handler (slug) of the project. Obtain from DevantGetWorkspaceContextTool (selectedProject.handler) or DevantListProjectsTool.",
        },
        directoryPath: {
            type: "string",
            description: "Absolute filesystem path of the integration directory to narrow results to. Obtain from DevantGetGitInfoTool (workspaceFolderPath). Do NOT construct or guess this path — only use the value returned by DevantGetGitInfoTool.",
        },
    },
    required: ["orgId", "orgHandle", "projectId", "projectHandler"],
});

export async function devantListIntegrations(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantListIntegrationsInput,
): Promise<ComponentKind[]> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_LIST_INTEGRATIONS_TOOL,
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
        console.log(`[${DEVANT_LIST_INTEGRATIONS_TOOL}] Filtered to ${components.length} integrations matching directory "${input.directoryPath}"`);
    } else {
        components = await ext.clients.rpcClient.getComponentList({
            orgId: input.orgId,
            orgHandle: input.orgHandle,
            projectId: input.projectId,
            projectHandle: input.projectHandler,
        });
        console.log(`[${DEVANT_LIST_INTEGRATIONS_TOOL}] Returning ${components.length} integrations for project "${input.projectHandler}"`);
    }

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_LIST_INTEGRATIONS_TOOL,
        toolOutput: components,
        toolCallId,
    });

    return components;
}

export function createDevantListIntegrationsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves integration components in a Devant project, optionally scoped to a specific directory.

**Purpose:**
Returns integration components already registered in a Devant project. When \`directoryPath\` is provided, only integrations whose source path matches that directory are returned, which is more precise and efficient than scanning all project integrations.

**When to use this tool:**
- When the user asks to see their integrations or components
- Before creating a new integration, to check whether one already exists for the same directory — pass \`directoryPath\` to scope the check to the current workspace folder
- When you need to resolve a component name to its ID or metadata for operations like delete

**Prerequisites:**
Call DevantGetWorkspaceContextTool first to obtain \`orgId\`, \`orgHandle\`, \`projectId\`, and \`projectHandler\` from \`selectedOrg\` and \`selectedProject\`.

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
        inputSchema: DevantListIntegrationsSchema,
        execute: async (input: DevantListIntegrationsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_LIST_INTEGRATIONS_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantListIntegrations(eventHandler, toolCallId, input);
        },
    });
}
