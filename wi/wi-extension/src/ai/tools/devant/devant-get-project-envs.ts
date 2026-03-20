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
import { DevantToolEventHandler, Environment } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";

export const DEVANT_GET_PROJECT_ENVS_TOOL = "DevantGetProjectEnvsTool";

export interface DevantGetProjectEnvsInput {
    orgId: string;
    orgHandle: string;
    projectId: string;
}

const DevantGetProjectEnvsSchema = jsonSchema<DevantGetProjectEnvsInput>({
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
        projectId: {
            type: "string",
            description: "Unique ID of the project. Obtain from DevantGetWorkspaceContextTool (selectedProject.id) or DevantListProjectsTool.",
        },
    },
    required: ["orgId", "orgHandle", "projectId"],
});

export async function devantGetProjectEnvs(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantGetProjectEnvsInput,
): Promise<Environment[]> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_GET_PROJECT_ENVS_TOOL,
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

    const envs = await ext.clients.rpcClient.getEnvs({
        orgId: input.orgId,
        orgUuid: org.uuid,
        projectId: input.projectId,
    });

    console.log(`[${DEVANT_GET_PROJECT_ENVS_TOOL}] Returning ${envs.length} environments for project "${input.projectId}"`);

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_GET_PROJECT_ENVS_TOOL,
        toolOutput: envs,
        toolCallId,
    });

    return envs;
}

export function createDevantGetProjectEnvsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves the list of environments configured for a Devant project.

**Purpose:**
Returns all deployment environments (e.g., Development, Staging, Production) available for a Devant project.

**When to use this tool:**
- When the user asks about the environments in their project
- Before any operation that requires an environment ID (deployments, connections, proxy setup)
- When you need to resolve an environment name to its ID

**Prerequisites:**
Call DevantGetWorkspaceContextTool first to obtain \`orgId\` (selectedOrg.id), \`orgHandle\` (selectedOrg.handle), and \`projectId\` (selectedProject.id).
If \`isAssociated\` is false, call DevantAssociateWorkspaceTool to link the workspace to a project before using this tool.

**Response Format:**
Returns a list of environment objects, each containing:
- id: Unique environment identifier
- name: Human-readable environment name (e.g., "Development", "Production")
- description: Description of the environment
- critical: Whether this is a critical (production-grade) environment
- choreoEnv: Internal environment identifier used by the platform
`,
        inputSchema: DevantGetProjectEnvsSchema,
        execute: async (input: DevantGetProjectEnvsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_GET_PROJECT_ENVS_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantGetProjectEnvs(eventHandler, toolCallId, input);
        },
    });
}
