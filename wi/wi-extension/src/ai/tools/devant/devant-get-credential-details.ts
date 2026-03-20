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

export const DEVANT_GET_CREDENTIAL_DETAILS_TOOL = "DevantGetCredentialDetailsTool";

export interface DevantGetCredentialDetailsInput {
    orgId: string;
    orgHandle: string;
    credentialId: string;
}

const DevantGetCredentialDetailsSchema = jsonSchema<DevantGetCredentialDetailsInput>({
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
        credentialId: {
            type: "string",
            description: "The unique ID of the credential to retrieve. Obtain from DevantGetCredentialsTool.",
        },
    },
    required: ["orgId", "orgHandle", "credentialId"],
});

export async function devantGetCredentialDetails(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantGetCredentialDetailsInput,
): Promise<CredentialItem> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_GET_CREDENTIAL_DETAILS_TOOL,
        toolInput: input,
        toolCallId,
    });

    const userInfo = ext.authProvider?.getState().state?.userInfo;
    if (!userInfo) {
        throw new Error("User not authenticated. Please sign in to Devant first.");
    }
    const org = userInfo.organizations?.find((o) => o.handle === input.orgHandle);
    if (!org) {
        throw new Error(`Organization "${input.orgHandle}" not found. Call DevantListOrgsTool to verify the org handle.`);
    }

    const credential = await ext.clients.rpcClient.getCredentialDetails({
        orgId: input.orgId,
        orgUuid: org.uuid,
        credentialId: input.credentialId,
    });

    console.log(`[${DEVANT_GET_CREDENTIAL_DETAILS_TOOL}] Retrieved credential "${credential?.name}" (${input.credentialId})`);

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_GET_CREDENTIAL_DETAILS_TOOL,
        toolOutput: credential,
        toolCallId,
    });

    return credential;
}

export function createDevantGetCredentialDetailsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves the full details of a specific git credential by ID.

**Purpose:**
Returns the complete details of a single credential configured in the organization's Devant settings.

**When to use this tool:**
- When you need the full details of a specific credential (e.g. its serverUrl or type) before using it
- After calling DevantGetCredentialsTool and identifying a credential by name, use this to fetch its complete data

**Prerequisites:**
1. Call DevantGetWorkspaceContextTool first to obtain \`orgId\` (selectedOrg.id) and \`orgHandle\` (selectedOrg.handle).
2. Obtain the \`credentialId\` from DevantGetCredentialsTool.

**Response Format:**
Returns a credential object containing:
- \`id\`: Unique credential identifier
- \`name\`: Human-readable credential name
- \`type\`: Credential type (e.g. username/password, token)
- \`serverUrl\`: The git server URL this credential applies to
- \`referenceToken\`: Opaque reference token used when linking this credential to a component
- \`createdAt\`: When the credential was created
`,
        inputSchema: DevantGetCredentialDetailsSchema,
        execute: async (input: DevantGetCredentialDetailsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_GET_CREDENTIAL_DETAILS_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantGetCredentialDetails(eventHandler, toolCallId, input);
        },
    });
}
