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
import { DevantToolEventHandler, Project } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";

export const DEVANT_LIST_PROJECTS_TOOL = "DevantListProjectsTool";

export interface DevantListProjectsInput {
    orgId: string;
}

const DevantListProjectsSchema = jsonSchema<DevantListProjectsInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: "The numeric ID of the organization whose projects to list. Use DevantListOrgsTool to obtain this value.",
        },
    },
    required: ["orgId"],
});

export async function devantListProjects(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    orgId: string,
): Promise<Project[]> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_LIST_PROJECTS_TOOL,
        toolInput: { orgId },
        toolCallId,
    });

    const projects = await ext.clients.rpcClient.getProjects(orgId);

    console.log(`[${DEVANT_LIST_PROJECTS_TOOL}] Returning ${projects.length} projects`);

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_LIST_PROJECTS_TOOL,
        toolOutput: projects,
        toolCallId,
    });

    return projects;
}

export function createDevantListProjectsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Lists all projects available in the Devant platform for a given organization.

**Purpose:**
Retrieves the list of Devant projects the user has access to within a specific organization.

**What is a Devant Project:**
A project in Devant is the top-level organizational unit that groups related components (services, integrations, tasks) together.

**When to use this tool:**
- When the user asks to see their Devant projects
- Before performing project-specific operations (deployments, environment management, component listing)
- When you need to resolve a project name/handler to its ID, or to let the user pick a project

**How to obtain the orgId — follow these steps in order:**
1. Call DevantGetWorkspaceContextTool first.
2. If selectedOrg is non-null, use selectedOrg.id as the orgId immediately — do not ask the user.
3. If selectedOrg is null, call DevantListOrgsTool, present the list to the user, and use the id of the chosen organization.

**Response Format:**
Returns a list of project objects, each containing:
- id: Unique project identifier
- name: Human-readable project name
- description: Brief description of the project's purpose
- handler: Project handle (URL-friendly name), used by DevantAssociateWorkspaceTool

**Example (workspace already associated):**
User: "Show me my Devant projects"
→ DevantGetWorkspaceContextTool → selectedOrg is non-null
→ DevantListProjectsTool with { orgId: selectedOrg.id }

**Example (no org in context):**
User: "Show me my Devant projects"
→ DevantGetWorkspaceContextTool → selectedOrg is null
→ DevantListOrgsTool → present list → user picks
→ DevantListProjectsTool with { orgId: "<chosen org id>" }
`,
        inputSchema: DevantListProjectsSchema,
        execute: async (input: DevantListProjectsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_LIST_PROJECTS_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantListProjects(eventHandler, toolCallId, input.orgId);
        },
    });
}
