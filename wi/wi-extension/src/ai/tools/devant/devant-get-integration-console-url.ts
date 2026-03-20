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

export const DEVANT_GET_INTEGRATION_CONSOLE_URL_TOOL = "DevantGetIntegrationConsoleUrlTool";

export interface DevantGetIntegrationConsoleUrlInput {
    orgHandle: string;
    projectId: string;
    componentHandler: string;
}

export interface DevantGetIntegrationConsoleUrlResult {
    consoleUrl: string;
}

const DevantGetIntegrationConsoleUrlSchema = jsonSchema<DevantGetIntegrationConsoleUrlInput>({
    type: "object",
    properties: {
        orgHandle: {
            type: "string",
            description: "Handle (slug) of the organization. Obtain from DevantGetWorkspaceContextTool (selectedOrg.handle) or DevantListOrgsTool.",
        },
        projectId: {
            type: "string",
            description: "Unique ID of the project. Obtain from DevantGetWorkspaceContextTool (selectedProject.id) or DevantListProjectsTool.",
        },
        componentHandler: {
            type: "string",
            description: "The component handler (URL-safe name). Available as `metadata.handler` on the component returned by DevantCreateIntegrationTool or DevantListIntegrationsTool.",
        },
    },
    required: ["orgHandle", "projectId", "componentHandler"],
});

export async function devantGetIntegrationConsoleUrl(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantGetIntegrationConsoleUrlInput,
): Promise<DevantGetIntegrationConsoleUrlResult> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_GET_INTEGRATION_CONSOLE_URL_TOOL,
        toolInput: input,
        toolCallId,
    });

    const devantConsoleUrl = ext.config?.devantConsoleUrl
        ?? (await ext.clients.rpcClient.getConfigFromCli()).devantConsoleUrl;

    const consoleUrl = `${devantConsoleUrl}/organizations/${input.orgHandle}/projects/${input.projectId}/components/${input.componentHandler}/overview`;

    console.log(`[${DEVANT_GET_INTEGRATION_CONSOLE_URL_TOOL}] URL for "${input.componentHandler}": ${consoleUrl}`);

    const result: DevantGetIntegrationConsoleUrlResult = { consoleUrl };

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_GET_INTEGRATION_CONSOLE_URL_TOOL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createDevantGetIntegrationConsoleUrlTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Returns the Devant console URL for a specific integration component.

**Purpose:**
Constructs and returns the direct URL to an integration's overview page in the Devant console. Present this to the user as a clickable link so they can view build status, deployments, and other details.

**When to use this tool:**
- Immediately after DevantCreateIntegrationTool succeeds — give the user a link to their newly created integration
- When the user asks to view or open an integration in the Devant console
- When you need the direct URL to a specific component (e.g. to share with the user)

**How to get the inputs:**
- \`orgHandle\`: from DevantGetWorkspaceContextTool (\`selectedOrg.handle\`)
- \`projectId\`: from DevantGetWorkspaceContextTool (\`selectedProject.id\`)
- \`componentHandler\`: from a newly created integration (\`component.metadata.handler\` returned by DevantCreateIntegrationTool), or from an existing integration (\`metadata.handler\` from DevantListIntegrationsTool)

**Response Format:**
Returns \`{ consoleUrl }\` — present this as a clickable link to the user.
`,
        inputSchema: DevantGetIntegrationConsoleUrlSchema,
        execute: async (input: DevantGetIntegrationConsoleUrlInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_GET_INTEGRATION_CONSOLE_URL_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantGetIntegrationConsoleUrl(eventHandler, toolCallId, input);
        },
    });
}
