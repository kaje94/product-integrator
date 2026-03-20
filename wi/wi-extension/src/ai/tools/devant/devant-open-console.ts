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

export const DEVANT_OPEN_CONSOLE_TOOL = "DevantOpenConsoleTool";

export interface DevantOpenConsoleInput {
    task: string;
    orgHandle?: string;
    projectId?: string;
}

export interface DevantOpenConsoleResult {
    url: string;
    message: string;
}

const DevantOpenConsoleSchema = jsonSchema<DevantOpenConsoleInput>({
    type: "object",
    properties: {
        task: {
            type: "string",
            description: "A short description of the task the user wants to perform (e.g. 'delete project', 'manage team members', 'configure billing').",
        },
        orgHandle: {
            type: "string",
            description: "Handle (slug) of the organization. Obtain from DevantGetWorkspaceContextTool (selectedOrg.handle). Used to construct a more specific console URL.",
        },
        projectId: {
            type: "string",
            description: "Unique ID of the project. Obtain from DevantGetWorkspaceContextTool (selectedProject.id). Used to construct a more specific console URL.",
        },
    },
    required: ["task"],
});

export async function devantOpenConsole(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantOpenConsoleInput,
): Promise<DevantOpenConsoleResult> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_OPEN_CONSOLE_TOOL,
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

    const result: DevantOpenConsoleResult = {
        url,
        message: `This action ("${input.task}") is not supported directly from the chat. Please complete it in the Devant console: ${url}`,
    };

    console.log(`[${DEVANT_OPEN_CONSOLE_TOOL}] Redirecting for task "${input.task}" → ${url}`);

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_OPEN_CONSOLE_TOOL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createDevantOpenConsoleTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Redirects the user to the Devant console to perform a task that is not supported in the chat.

**When to use this tool:**
Use this tool as a LAST RESORT — only when ALL of the following conditions are met:
1. The user's request is clearly related to Devant (projects, organizations, components, deployments, billing, team management, etc.)
2. None of the other available Devant tools (DevantListOrgsTool, DevantListProjectsTool, DevantCreateProjectTool, etc.) can fulfill the request
3. The task must be performed manually in the Devant console

**Do NOT use this tool if any other Devant tool can handle the request.**

**What this tool does:**
- Constructs the most relevant Devant console URL using the provided org and project context
- Returns the URL and a message to present to the user

**How to get the optional inputs:**
- \`orgHandle\`: from DevantGetWorkspaceContextTool (\`selectedOrg.handle\`) — pass if available for a more specific URL
- \`projectId\`: from DevantGetWorkspaceContextTool (\`selectedProject.id\`) — pass if available for a more specific URL

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
        inputSchema: DevantOpenConsoleSchema,
        execute: async (input: DevantOpenConsoleInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_OPEN_CONSOLE_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantOpenConsole(eventHandler, toolCallId, input);
        },
    });
}
