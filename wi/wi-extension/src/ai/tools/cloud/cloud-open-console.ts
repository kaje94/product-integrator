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
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";
import { DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";



export interface CloudOpenConsoleInput {
    task: string;
    orgHandle?: string;
    projectId?: string;
}

export interface CloudOpenConsoleResult {
    url: string;
    message: string;
}

const CloudOpenConsoleSchema = jsonSchema<CloudOpenConsoleInput>({
    type: "object",
    properties: {
        task: {
            type: "string",
            description: `A short description of the task the user wants to perform (e.g. 'delete project', 'manage team members', 'configure billing').`,
        },
        orgHandle: {
            type: "string",
            description: `Handle (slug) of the organization. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedOrg.handle). Used to construct a more specific console URL.`,
        },
        projectId: {
            type: "string",
            description: `Unique ID of the project. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedProject.id). Used to construct a more specific console URL.`,
        },
    },
    required: ["task"],
});

export async function cloudOpenConsole(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: CloudOpenConsoleInput,
): Promise<CloudOpenConsoleResult> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.OPEN_CONSOLE,
        toolInput: input,
        toolCallId,
    });

    const baseUrl = ext.config?.devantConsoleUrl ?? (await ext.clients.rpcClient.getConfigFromCli()).devantConsoleUrl;

    let url = baseUrl;
    if (input.orgHandle) {
        url = `${baseUrl}/organizations/${input.orgHandle}`;
        if (input.projectId) {
            url = `${baseUrl}/organizations/${input.orgHandle}/projects/${input.projectId}`;
        }
    }

    const result: CloudOpenConsoleResult = {
        url,
        message: `This action ("${input.task}") is not supported directly from the chat. Please complete it in the WSO2 Cloud console: ${url}`,
    };

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.OPEN_CONSOLE}] Redirecting for task "${input.task}" → ${url}`);

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.OPEN_CONSOLE,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createCloudOpenConsoleTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Redirects the user to the WSO2 Cloud console to perform a task that is not supported in the chat.

**When to use this tool:**
Use this tool as a LAST RESORT — only when ALL of the following conditions are met:
1. The user's request is clearly related to WSO2 Cloud (projects, organizations, components, deployments, billing, team management, etc.)
2. None of the other available WSO2 Cloud tools (${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}, ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}, ${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT}, etc.) can fulfill the request
3. The task must be performed manually in the WSO2 Cloud console

**Do NOT use this tool if any other WSO2 Cloud tool can handle the request.**

**What this tool does:**
- Constructs the most relevant WSO2 Cloud console URL using the provided org and project context
- Returns the URL and a message to present to the user

**How to get the optional inputs:**
- \`orgHandle\`: from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (\`selectedOrg.handle\`) — pass if available for a more specific URL
- \`projectId\`: from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (\`selectedProject.id\`) — pass if available for a more specific URL

**Response:**
Present the returned message to the user and include the URL as a clickable link so they can navigate directly to the right place in the console.

**Examples of tasks that require this tool:**
- "Delete this project"
- "Remove a team member from the organization"
- "Manage billing or subscription"
- "Configure organization-level settings"
- "Set up CI/CD pipelines"
- "Rotate API keys or credentials"
`,
        inputSchema: CloudOpenConsoleSchema,
        execute: async (input: CloudOpenConsoleInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.OPEN_CONSOLE}] Called [toolCallId: ${toolCallId}]`);
            return await cloudOpenConsole(eventHandler, toolCallId, input);
        },
    });
}
