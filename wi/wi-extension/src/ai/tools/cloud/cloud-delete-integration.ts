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
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudDeleteIntegrationInput {
    orgId: string;
    orgHandle: string;
    projectId: string;
    projectHandler: string;
    componentId: string;
    componentName: string;
}

export interface CloudDeleteIntegrationResult {
    success: boolean;
    message: string;
}

const CloudDeleteIntegrationSchema = jsonSchema<CloudDeleteIntegrationInput>({
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
        componentId: {
            type: "string",
            description: `Unique ID of the integration component to delete. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS} (metadata.id).`,
        },
        componentName: {
            type: "string",
            description: `Display name of the integration component. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS} (metadata.displayName). Used to confirm the deletion with the user.`,
        },
    },
    required: ["orgId", "orgHandle", "projectId", "projectHandler", "componentId", "componentName"],
});

export async function cloudDeleteIntegration(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: CloudDeleteIntegrationInput,
): Promise<CloudDeleteIntegrationResult> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.DELETE_INTEGRATION,
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

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.DELETE_INTEGRATION}] Deleted integration "${input.componentName}" (${input.componentId})`);

    // Remove from local cache and refresh workspace context
    const compCache = dataCacheStore.getState().getComponents(input.orgHandle, input.projectHandler);
    dataCacheStore.getState().setComponents(
        input.orgHandle,
        input.projectHandler,
        compCache.filter((item) => item.metadata.id !== input.componentId),
    );
    contextStore.getState().refreshState();

    const result: CloudDeleteIntegrationResult = {
        success: true,
        message: `Integration "${input.componentName}" has been successfully deleted from WSO2 Cloud. This action only removed the integration from the WSO2 Cloud platform — local files are not affected.`,
    };

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.DELETE_INTEGRATION,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createCloudDeleteIntegrationTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Deletes an existing integration component from a WSO2 Cloud project.

**Purpose:**
Permanently removes an integration component from the WSO2 Cloud platform. This action only affects the WSO2 Cloud registration — it does not delete any local source files.

**This action is irreversible. You MUST explicitly confirm with the user before calling this tool.**

**How to use this tool:**
1. Call ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} to obtain \`orgId\`, \`orgHandle\`, \`projectId\`, and \`projectHandler\`.
2. Call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS} to list current integrations and identify the target component. Use \`metadata.id\` as \`componentId\` and \`metadata.displayName\` as \`componentName\`.
3. **Ask the user to confirm** they want to permanently delete the named integration before calling this tool. Do not proceed without explicit confirmation.
4. Call this tool with the confirmed inputs.

**Response Format:**
- \`success: true\` + \`message\` — the integration was deleted; present the message to the user
- If the call throws, surface the error message to the user and do not retry automatically
`,
        inputSchema: CloudDeleteIntegrationSchema,
        execute: async (input: CloudDeleteIntegrationInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.DELETE_INTEGRATION}] Called [toolCallId: ${toolCallId}]`);
            return await cloudDeleteIntegration(eventHandler, toolCallId, input);
        },
    });
}
