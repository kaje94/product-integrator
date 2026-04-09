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
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudGetProjectEnvsInput {
    orgId: string;
    orgHandle: string;
    projectId: string;
}

const CloudGetProjectEnvsSchema = jsonSchema<CloudGetProjectEnvsInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: `Numeric ID of the organization. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedOrg.id) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}.`,
        },
        orgHandle: {
            type: "string",
            description: `Handle (slug) of the organization. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedOrg.handle) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}.`,
        },
        projectId: {
            type: "string",
            description: `Unique ID of the project. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} (selectedProject.id) or ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_PROJECTS}.`,
        },
    },
    required: ["orgId", "orgHandle", "projectId"],
});

export async function cloudGetProjectEnvs(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: CloudGetProjectEnvsInput,
): Promise<Environment[]> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_PROJECT_ENVS,
        toolInput: input,
        toolCallId,
    });

    const userInfo = ext.authProvider?.getState().state?.userInfo;
    if (!userInfo) {
        throw new Error("User not authenticated. Please sign in to WSO2 Cloud first.");
    }
    const org = userInfo.organizations?.find((o) => o.handle === input.orgHandle);
    if (!org) {
        throw new Error(`Organization "${input.orgHandle}" not found. Call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS} to verify the org handle.`);
    }

    const envs = await ext.clients.rpcClient.getEnvs({
        orgId: input.orgId,
        orgUuid: org.uuid,
        projectId: input.projectId,
    });

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.GET_PROJECT_ENVS}] Returning ${envs.length} environments for project "${input.projectId}"`);

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.GET_PROJECT_ENVS,
        toolOutput: envs,
        toolCallId,
    });

    return envs;
}

export function createCloudGetProjectEnvsTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves the list of environments configured for a WSO2 Cloud project.

**Purpose:**
Returns all deployment environments (e.g., Development, Staging, Production) available for a WSO2 Cloud project.

**When to use this tool:**
- When the user asks about the environments in their project
- Before any operation that requires an environment ID (deployments, connections, proxy setup)
- When you need to resolve an environment name to its ID

**Prerequisites:**
Call ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} first to obtain \`orgId\` (selectedOrg.id), \`orgHandle\` (selectedOrg.handle), and \`projectId\` (selectedProject.id).
If \`isAssociated\` is false, call ${WI_CLOUD_AGENT_TOOL_NAMES.ASSOCIATE_WORKSPACE} to link the workspace to a project before using this tool.

**Response Format:**
Returns a list of environment objects, each containing:
- id: Unique environment identifier
- name: Human-readable environment name (e.g., "Development", "Production")
- description: Description of the environment
- critical: Whether this is a critical (production-grade) environment
- choreoEnv: Internal environment identifier used by the platform
`,
        inputSchema: CloudGetProjectEnvsSchema,
        execute: async (input: CloudGetProjectEnvsInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.GET_PROJECT_ENVS}] Called [toolCallId: ${toolCallId}]`);
            return await cloudGetProjectEnvs(eventHandler, toolCallId, input);
        },
    });
}
