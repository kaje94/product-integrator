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
import { DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { contextStore } from "../../../cloud/stores/context-store";
import { dataCacheStore } from "../../../cloud/stores/data-cache-store";

export const DEVANT_DELETE_INTEGRATION_TOOL = "DevantDeleteIntegrationTool";

export interface DevantDeleteIntegrationInput {
    orgId: string;
    orgHandle: string;
    projectId: string;
    projectHandler: string;
    componentId: string;
    componentName: string;
}

export interface DevantDeleteIntegrationResult {
    success: boolean;
    message: string;
}

const DevantDeleteIntegrationSchema = jsonSchema<DevantDeleteIntegrationInput>({
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
        componentId: {
            type: "string",
            description: "Unique ID of the integration component to delete. Obtain from DevantListIntegrationsTool (metadata.id).",
        },
        componentName: {
            type: "string",
            description: "Display name of the integration component. Obtain from DevantListIntegrationsTool (metadata.displayName). Used to confirm the deletion with the user.",
        },
    },
    required: ["orgId", "orgHandle", "projectId", "projectHandler", "componentId", "componentName"],
});

export async function devantDeleteIntegration(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantDeleteIntegrationInput,
): Promise<DevantDeleteIntegrationResult> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_DELETE_INTEGRATION_TOOL,
        toolInput: input,
        toolCallId,
    });

    await ext.clients.rpcClient.deleteComponent({
        orgId: input.orgId,
        orgHandler: input.orgHandle,
        projectId: input.projectId,
        componentId: input.componentId,
        componentName: input.componentName,
    });

    console.log(`[${DEVANT_DELETE_INTEGRATION_TOOL}] Deleted integration "${input.componentName}" (${input.componentId})`);

    // Remove from local cache and refresh workspace context
    const compCache = dataCacheStore.getState().getComponents(input.orgHandle, input.projectHandler);
    dataCacheStore.getState().setComponents(
        input.orgHandle,
        input.projectHandler,
        compCache.filter((item) => item.metadata.id !== input.componentId),
    );
    contextStore.getState().refreshState();

    const result: DevantDeleteIntegrationResult = {
        success: true,
        message: `Integration "${input.componentName}" has been successfully deleted from Devant. This action only removed the integration from the Devant platform — local files are not affected.`,
    };

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_DELETE_INTEGRATION_TOOL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createDevantDeleteIntegrationTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Deletes an existing integration component from a Devant project.

**Purpose:**
Permanently removes an integration component from the Devant platform. This action only affects the Devant registration — it does not delete any local source files.

**This action is irreversible. You MUST explicitly confirm with the user before calling this tool.**

**How to use this tool:**
1. Call DevantGetWorkspaceContextTool to obtain \`orgId\`, \`orgHandle\`, \`projectId\`, and \`projectHandler\`.
2. Call DevantListIntegrationsTool to list current integrations and identify the target component. Use \`metadata.id\` as \`componentId\` and \`metadata.displayName\` as \`componentName\`.
3. **Ask the user to confirm** they want to permanently delete the named integration before calling this tool. Do not proceed without explicit confirmation.
4. Call this tool with the confirmed inputs.

**Response Format:**
- \`success: true\` + \`message\` — the integration was deleted; present the message to the user
- If the call throws, surface the error message to the user and do not retry automatically
`,
        inputSchema: DevantDeleteIntegrationSchema,
        execute: async (input: DevantDeleteIntegrationInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_DELETE_INTEGRATION_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantDeleteIntegration(eventHandler, toolCallId, input);
        },
    });
}
