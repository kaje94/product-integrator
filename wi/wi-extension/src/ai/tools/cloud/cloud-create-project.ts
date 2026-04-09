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

import * as vscode from "vscode";
import { tool, jsonSchema } from "ai";
import { DevantToolEventHandler, Project } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { contextStore } from "../../../cloud/stores/context-store";
import { dataCacheStore } from "../../../cloud/stores/data-cache-store";
import { updateContextFile as updateContextFileUtil } from "../../../cloud/cmds/create-directory-context-cmd";
import { getGitRoot } from "../../../cloud/git/util";
import { WI_CLOUD_AGENT_TOOL_NAMES } from "./cloud-tool-names";

export interface CloudCreateProjectInput {
    orgId: string;
    orgHandler: string;
    projectName: string;
}

const CloudCreateProjectSchema = jsonSchema<CloudCreateProjectInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: `The numeric ID of the organization to create the project in. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}.`,
        },
        orgHandler: {
            type: "string",
            description: `The handle (slug) of the organization. Obtain from ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}.`,
        },
        projectName: {
            type: "string",
            description: "The name for the new WSO2 Cloud project.",
        },
    },
    required: ["orgId", "orgHandler", "projectName"],
});

export async function cloudCreateProject(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: CloudCreateProjectInput,
): Promise<Project> {
    eventHandler({
        type: "tool_call",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT,
        toolInput: input,
        toolCallId,
    });

    const region = ext.authProvider?.getState().state?.region ?? "US";

    const project = await ext.clients.rpcClient.createProject({
        orgId: input.orgId,
        orgHandler: input.orgHandler,
        projectName: input.projectName,
        region,
    });

    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT}] Created project: ${project.name} (${project.id})`);

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
        try {
            const userInfo = ext.authProvider?.getState().state?.userInfo;
            const org = userInfo?.organizations?.find((o) => o.handle === input.orgHandler);
            if (userInfo && org) {
                const projectList = dataCacheStore.getState().getProjects(input.orgHandler);
                const gitRoot = await getGitRoot(ext.context, workspacePath);
                if (gitRoot) {
                    updateContextFileUtil(gitRoot, userInfo, project, org, projectList);
                    await contextStore.getState().refreshState();
                    console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT}] Workspace associated with project and state refreshed`);
                }
            }
        } catch (err) {
            console.error(`[${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT}] Failed to update context file or refresh state: ${err}`);
        }
    }

    eventHandler({
        type: "tool_result",
        toolName: WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT,
        toolOutput: project,
        toolCallId,
    });

    return project;
}

export function createCloudCreateProjectTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Creates a new project in the WSO2 Cloud platform under a specified organization.

**Purpose:**
Creates a new WSO2 Cloud project that can then be used to group related components (services, integrations, tasks).
After creation, the current workspace is automatically associated with the new project.

**When to use this tool:**
- When the user explicitly asks to create a new WSO2 Cloud project

**How to obtain the required inputs — follow these steps in order:**
1. Call ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} first.
2. For orgId and orgHandler:
   - If selectedOrg is non-null, use selectedOrg.id and selectedOrg.handle — do not ask the user
   - If selectedOrg is null, call ${WI_CLOUD_AGENT_TOOL_NAMES.LIST_ORGS}, present the list, and use the chosen org's id and handle
3. Ask the user for the project name if not already provided.

**Response Format:**
Returns the created project object containing:
- id: Unique project identifier
- name: Project name
- handler: Project handle (URL-friendly name)
- region: Cloud region the project was created in

After creation, the current workspace is automatically associated with the new project (context file updated and state refreshed).

**Example:**
User: "Create a new project called Payment Service"
→ ${WI_CLOUD_AGENT_TOOL_NAMES.GET_WORKSPACE_CONTEXT} → selectedOrg is non-null
→ ${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT} with { orgId: selectedOrg.id, orgHandler: selectedOrg.handle, projectName: "Payment Service" }
`,
        inputSchema: CloudCreateProjectSchema,
        execute: async (input: CloudCreateProjectInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${WI_CLOUD_AGENT_TOOL_NAMES.CREATE_PROJECT}] Called [toolCallId: ${toolCallId}]`);
            return await cloudCreateProject(eventHandler, toolCallId, input);
        },
    });
}
