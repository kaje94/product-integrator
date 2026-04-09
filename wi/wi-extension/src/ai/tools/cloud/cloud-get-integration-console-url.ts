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
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudGetIntegrationConsoleUrlInput {
    orgHandle: string;
    projectId: string;
    componentHandler: string;
}

export interface CloudGetIntegrationConsoleUrlResult {
    consoleUrl: string;
}

const CloudGetIntegrationConsoleUrlSchema = jsonSchema<CloudGetIntegrationConsoleUrlInput>({
    type: "object",
    properties: {
        orgHandle: {
            type: "string",
            description: `Handle (slug) of the organization. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedOrg.handle) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}.`,
        },
        projectId: {
            type: "string",
            description: `Unique ID of the project. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedProject.id) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}.`,
        },
        componentHandler: {
            type: "string",
            description: `The component handler (URL-safe name). Available as \`metadata.handler\` on the component returned by ${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION} or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS}.`,
        },
    },
    required: ["orgHandle", "projectId", "componentHandler"],
});

export async function cloudGetIntegrationConsoleUrl(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: CloudGetIntegrationConsoleUrlInput,
): Promise<CloudGetIntegrationConsoleUrlResult> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_INTEGRATION_CONSOLE_URL,
        toolInput: input,
        toolCallId,
    });

    const devantConsoleUrl = ext.config?.devantConsoleUrl
        ?? (await ext.clients.rpcClient.getConfigFromCli()).devantConsoleUrl;

    const consoleUrl = `${devantConsoleUrl}/organizations/${input.orgHandle}/projects/${input.projectId}/components/${input.componentHandler}/overview`;

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.GET_INTEGRATION_CONSOLE_URL}] URL for "${input.componentHandler}": ${consoleUrl}`);

    const result: CloudGetIntegrationConsoleUrlResult = { consoleUrl };

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_INTEGRATION_CONSOLE_URL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createCloudGetIntegrationConsoleUrlTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Returns the WSO2 Cloud console URL for a specific integration component.

**Purpose:**
Constructs and returns the direct URL to an integration's overview page in the WSO2 Cloud console. Present this to the user as a clickable link so they can view build status, deployments, and other details.

**When to use this tool:**
- Immediately after ${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION} succeeds — give the user a link to their newly created integration
- When the user asks to view or open an integration in the WSO2 Cloud console
- When you need the direct URL to a specific component (e.g. to share with the user)

**How to get the inputs:**
- \`orgHandle\`: from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (\`selectedOrg.handle\`)
- \`projectId\`: from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (\`selectedProject.id\`)
- \`componentHandler\`: from a newly created integration (\`component.metadata.handler\` returned by ${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_INTEGRATION}), or from an existing integration (\`metadata.handler\` from ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_INTEGRATIONS})

**Response Format:**
Returns \`{ consoleUrl }\` — present this as a clickable link to the user.
`,
        inputSchema: CloudGetIntegrationConsoleUrlSchema,
        execute: async (input: CloudGetIntegrationConsoleUrlInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.GET_INTEGRATION_CONSOLE_URL}] Called [toolCallId: ${toolCallId}]`);
            return await cloudGetIntegrationConsoleUrl(eventHandler, toolCallId, input);
        },
    });
}
