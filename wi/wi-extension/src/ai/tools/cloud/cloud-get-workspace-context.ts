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
import { DevantToolEventHandler, Organization, Project } from "@wso2/wso2-platform-core";
import { contextStore } from "../../../cloud/stores/context-store";
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudWorkspaceContext {
    selectedProject: Project | null;
    selectedOrg: Organization | null;
    isAssociated: boolean;
}

const CloudGetWorkspaceContextSchema = jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
});

export function cloudGetWorkspaceContext(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
): CloudWorkspaceContext {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT,
        toolInput: {},
        toolCallId,
    });

    const selected = contextStore.getState().state?.selected;
    const result: CloudWorkspaceContext = {
        selectedProject: selected?.project ?? null,
        selectedOrg: selected?.org ?? null,
        isAssociated: !!(selected?.project && selected?.org),
    };

    console.log(
        `[${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}] isAssociated=${result.isAssociated}, org=${result.selectedOrg?.name ?? "none"}, project=${result.selectedProject?.name ?? "none"}`
    );

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createCloudGetWorkspaceContextTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Returns the WSO2 Cloud project and organization currently associated with the workspace.

**Purpose:**
Reads the workspace context (from the .choreo/context.yaml association file) and returns the currently linked WSO2 Cloud project and organization.

**When to use this tool:**
Call this tool as the FIRST STEP before any other WSO2 Cloud tool. It tells you immediately whether the workspace is already associated with a project and org, so you can avoid unnecessary follow-up calls.

**Response Format:**
Returns an object with:
- isAssociated (boolean): true when the workspace is linked to both a project and an org
- selectedOrg (Organization | null): the associated organization, or null if none
- selectedProject (Project | null): the associated project, or null if none

**How to use the result:**
- isAssociated is true → selectedOrg and selectedProject are available; use them directly for operations that require org/project context — do not call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}
- isAssociated is false, selectedOrg is non-null → org is known but no project is linked; call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS} with selectedOrg.id to let the user pick a project
- isAssociated is false, selectedOrg is null → no context at all; call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} to get the org list, then proceed from there

**Typical flow:**
User asks anything WSO2 Cloud-related
→ Call ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}
→ Branch on isAssociated / selectedOrg / selectedProject
→ Proceed with the appropriate tool
`,
        inputSchema: CloudGetWorkspaceContextSchema,
        execute: async (_input: Record<string, never>, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT}] Called [toolCallId: ${toolCallId}]`);
            return cloudGetWorkspaceContext(eventHandler, toolCallId);
        },
    });
}
