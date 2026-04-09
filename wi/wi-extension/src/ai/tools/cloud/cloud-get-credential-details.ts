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
import { CredentialItem, DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudGetCredentialDetailsInput {
    orgId: string;
    orgHandle: string;
    credentialId: string;
}

const CloudGetCredentialDetailsSchema = jsonSchema<CloudGetCredentialDetailsInput>({
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
        credentialId: {
            type: "string",
            description: `The unique ID of the credential to retrieve. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIALS}.`,
        },
    },
    required: ["orgId", "orgHandle", "credentialId"],
});

export async function cloudGetCredentialDetails(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: CloudGetCredentialDetailsInput,
): Promise<CredentialItem> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIAL_DETAILS,
        toolInput: input,
        toolCallId,
    });

    const userInfo = ext.authProvider?.getState().state?.userInfo;
    if (!userInfo) {
        throw new Error("User not authenticated. Please sign in to WSO2 Cloud first.");
    }
    const org = userInfo.organizations?.find((o) => o.handle === input.orgHandle);
    if (!org) {
        throw new Error(`Organization "${input.orgHandle}" not found. Call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} to verify the org handle.`);
    }

    const credential = await ext.clients.rpcClient.getCredentialDetails({
        orgId: input.orgId,
        orgUuid: org.uuid,
        credentialId: input.credentialId,
    });

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIAL_DETAILS}] Retrieved credential "${credential?.name}" (${input.credentialId})`);

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIAL_DETAILS,
        toolOutput: credential,
        toolCallId,
    });

    return credential;
}

export function createCloudGetCredentialDetailsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves the full details of a specific git credential by ID.

**Purpose:**
Returns the complete details of a single credential configured in the organization's WSO2 Cloud settings.

**When to use this tool:**
- When you need the full details of a specific credential (e.g. its serverUrl or type) before using it
- After calling ${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIALS} and identifying a credential by name, use this to fetch its complete data

**Prerequisites:**
1. Call ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} first to obtain \`orgId\` (selectedOrg.id) and \`orgHandle\` (selectedOrg.handle).
2. Obtain the \`credentialId\` from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIALS}.

**Response Format:**
Returns a credential object containing:
- \`id\`: Unique credential identifier
- \`name\`: Human-readable credential name
- \`type\`: Credential type (e.g. username/password, token)
- \`serverUrl\`: The git server URL this credential applies to
- \`referenceToken\`: Opaque reference token used when linking this credential to a component
- \`createdAt\`: When the credential was created
`,
        inputSchema: CloudGetCredentialDetailsSchema,
        execute: async (input: CloudGetCredentialDetailsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.GET_CREDENTIAL_DETAILS}] Called [toolCallId: ${toolCallId}]`);
            return await cloudGetCredentialDetails(eventHandler, toolCallId, input);
        },
    });
}
