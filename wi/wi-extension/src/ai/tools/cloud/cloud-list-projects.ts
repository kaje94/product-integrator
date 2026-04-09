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
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudListProjectsInput {
    orgId: string;
}

const CloudListProjectsSchema = jsonSchema<CloudListProjectsInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: `The numeric ID of the organization whose projects to list. Use ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} to obtain this value.`,
        },
    },
    required: ["orgId"],
});

export async function cloudListProjects(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    orgId: string,
): Promise<Project[]> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS,
        toolInput: { orgId },
        toolCallId,
    });

    const projects = await ext.clients.rpcClient.getProjects(orgId);

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}] Returning ${projects.length} projects`);

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS,
        toolOutput: projects,
        toolCallId,
    });

    return projects;
}

export function createCloudListProjectsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Lists all projects available in WSO2 Cloud for a given organization.

**Purpose:**
Retrieves the list of WSO2 Cloud projects the user has access to within a specific organization.

**What is a WSO2 Cloud Project:**
A project in WSO2 Cloud is the top-level organizational unit that groups related components (services, integrations, tasks) together.

**When to use this tool:**
- When the user asks to see their WSO2 Cloud projects
- Before performing project-specific operations (deployments, environment management, component listing)
- When you need to resolve a project name/handler to its ID, or to let the user pick a project

**How to obtain the orgId — follow these steps in order:**
1. Call ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} first.
2. If selectedOrg is non-null, use selectedOrg.id as the orgId immediately — do not ask the user.
3. If selectedOrg is null, call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}, present the list to the user, and use the id of the chosen organization.

**Response Format:**
Returns a list of project objects, each containing:
- id: Unique project identifier
- name: Human-readable project name
- description: Brief description of the project's purpose
- handler: Project handle (URL-friendly name), used by ${WI_CLOUD_AGENT_TOOL_NAMES.ASSOCIATE_WORKSPACE}

**Example (workspace already associated):**
User: "Show me my WSO2 Cloud projects"
→ ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} → selectedOrg is non-null
→ ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS} with { orgId: selectedOrg.id }

**Example (no org in context):**
User: "Show me my WSO2 Cloud projects"
→ ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} → selectedOrg is null
→ ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} → present list → user picks
→ ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS} with { orgId: "<chosen org id>" }
`,
        inputSchema: CloudListProjectsSchema,
        execute: async (input: CloudListProjectsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}] Called [toolCallId: ${toolCallId}]`);
            return await cloudListProjects(eventHandler, toolCallId, input.orgId);
        },
    });
}
