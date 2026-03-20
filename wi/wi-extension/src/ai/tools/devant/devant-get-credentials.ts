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

export const DEVANT_GET_CREDENTIALS_TOOL = "DevantGetCredentialsTool";

export interface DevantGetCredentialsInput {
    orgId: string;
    orgHandle: string;
}

const DevantGetCredentialsSchema = jsonSchema<DevantGetCredentialsInput>({
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
    },
    required: ["orgId", "orgHandle"],
});

export async function devantGetCredentials(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantGetCredentialsInput,
): Promise<CredentialItem[]> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_GET_CREDENTIALS_TOOL,
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

    const credentials = await ext.clients.rpcClient.getCredentials({
        orgId: input.orgId,
        orgUuid: org.uuid,
    });

    console.log(`[${DEVANT_GET_CREDENTIALS_TOOL}] Returning ${credentials?.length ?? 0} credentials for org "${input.orgHandle}"`);

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_GET_CREDENTIALS_TOOL,
        toolOutput: credentials,
        toolCallId,
    });

    return credentials ?? [];
}

export function createDevantGetCredentialsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves the list of git credentials configured for an organization in Devant.

**Purpose:**
Returns all repository credentials (e.g. for Bitbucket, GitLab, or private GitHub repos) configured in the organization's Devant settings. Use this to find an existing credential reference before creating an integration with a private repository.

**When to use this tool:**
- When the user asks to see their configured credentials
- Before creating an integration with a non-GitHub repository, to check if a credential already exists
- When you need to resolve a credential name to its ID for use in other operations

**Prerequisites:**
Call DevantGetWorkspaceContextTool first to obtain \`orgId\` (selectedOrg.id) and \`orgHandle\` (selectedOrg.handle).

**Response Format:**
Returns a list of credential objects, each containing:
- \`id\`: Unique credential identifier
- \`name\`: Human-readable credential name
- \`type\`: Credential type (e.g. username/password, token)
- \`serverUrl\`: The git server URL this credential applies to
- \`createdAt\`: When the credential was created
`,
        inputSchema: DevantGetCredentialsSchema,
        execute: async (input: DevantGetCredentialsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_GET_CREDENTIALS_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantGetCredentials(eventHandler, toolCallId, input);
        },
    });
}
