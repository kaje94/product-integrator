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
import { DevantToolEventHandler, Organization } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { contextStore } from "../../../cloud/stores/context-store";
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudListOrgsResult {
    organizations: Organization[];
    selectedOrg: Organization | null;
}

const CloudListOrgsSchema = jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
});

export async function cloudListOrgs(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
): Promise<CloudListOrgsResult> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS,
        toolInput: {},
        toolCallId,
    });

    const organizations = ext.authProvider?.getState().state?.userInfo?.organizations ?? [];
    const selectedOrg = contextStore.getState().state?.selected?.org ?? null;
    const result: CloudListOrgsResult = { organizations, selectedOrg };

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}] Returning ${organizations.length} organizations, selected: ${selectedOrg?.name ?? "none"}`);

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createCloudListOrgsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Lists all organizations available to the current user in the WSO2 Cloud platform.

**Purpose:**
Retrieves the full list of organizations the user belongs to.

**When to use this tool:**
Use this as a FALLBACK only when ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} returns selectedOrg as null.
Do NOT call this tool if ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} already returned a non-null selectedOrg.

**Response Format:**
Returns an object with:
- organizations: Array of all organizations the user belongs to, each with id (numeric), name, and handle
- selectedOrg: The organization currently selected in the workspace context, or null if none is selected

**How the result is used:**
- If selectedOrg is non-null → use selectedOrg.id and selectedOrg.handle directly
- If selectedOrg is null → present the organizations list to the user and ask them to choose one

**Example:**
${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} returns selectedOrg=null
→ Call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} to get all organizations
→ Present list to user, ask them to pick one
→ Use chosen org's id and handle for subsequent calls
`,
        inputSchema: CloudListOrgsSchema,
        execute: async (_input: Record<string, never>, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}] Called [toolCallId: ${toolCallId}]`);
            return await cloudListOrgs(eventHandler, toolCallId);
        },
    });
}
