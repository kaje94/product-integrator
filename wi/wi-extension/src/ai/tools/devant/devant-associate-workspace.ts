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
import { DevantWorkspaceContext } from "./devant-get-workspace-context";

export const DEVANT_ASSOCIATE_WORKSPACE_TOOL = "DevantAssociateWorkspaceTool";

export interface DevantAssociateWorkspaceInput {
    orgId: string;
    orgHandler: string;
    projectHandler: string;
}

const DevantAssociateWorkspaceSchema = jsonSchema<DevantAssociateWorkspaceInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: "The numeric ID of the organization. Obtain from DevantGetWorkspaceContextTool (selectedOrg.id) or DevantListOrgsTool.",
        },
        orgHandler: {
            type: "string",
            description: "The handle (slug) of the organization. Obtain from DevantGetWorkspaceContextTool (selectedOrg.handle) or DevantListOrgsTool.",
        },
        projectHandler: {
            type: "string",
            description: "The handler (slug) of the project to associate with. Obtain from DevantListProjectsTool (project.handler).",
        },
    },
    required: ["orgId", "orgHandler", "projectHandler"],
});

export async function devantAssociateWorkspace(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantAssociateWorkspaceInput,
): Promise<DevantWorkspaceContext> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_ASSOCIATE_WORKSPACE_TOOL,
        toolInput: input,
        toolCallId,
    });

    const projects = await ext.clients.rpcClient.getProjects(input.orgId);
    const project = projects.find((p: Project) => p.handler === input.projectHandler);
    if (!project) {
        throw new Error(`No project with handler "${input.projectHandler}" found in organization "${input.orgHandler}".`);
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        throw new Error("No active workspace path found.");
    }

    const userInfo = ext.authProvider?.getState().state?.userInfo;
    const org = userInfo?.organizations?.find((o) => o.handle === input.orgHandler);
    if (!userInfo || !org) {
        throw new Error("User not authenticated or organization not found.");
    }

    const projectList = dataCacheStore.getState().getProjects(input.orgHandler);
    const gitRoot = await getGitRoot(ext.context, workspacePath);
    if (!gitRoot) {
        throw new Error("No git repository found at the workspace path.");
    }
    updateContextFileUtil(gitRoot, userInfo, project, org, projectList);
    await contextStore.getState().refreshState();

    const selected = contextStore.getState().state?.selected;
    const result: DevantWorkspaceContext = {
        selectedProject: selected?.project ?? null,
        selectedOrg: selected?.org ?? null,
        isAssociated: !!(selected?.project && selected?.org),
    };

    console.log(`[${DEVANT_ASSOCIATE_WORKSPACE_TOOL}] Workspace associated with project "${project.name}" in org "${input.orgHandler}"`);

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_ASSOCIATE_WORKSPACE_TOOL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createDevantAssociateWorkspaceTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Associates the current workspace with a Devant project, or switches the association to a different project.

**Purpose:**
Writes a project association to the workspace's .choreo/context.yaml file and refreshes the extension state, so subsequent Devant operations are automatically scoped to that project and org.
Use this both for initial association (workspace has no linked project) and for switching to a different project.

**When to use this tool:**
- When the user asks to associate or link the workspace with a Devant project
- When the user asks to switch the workspace to a different Devant project
- After creating a new project (DevantCreateProjectTool already handles this automatically)

**How to obtain the required inputs — follow these steps in order:**
1. Call DevantGetWorkspaceContextTool first.
2. For orgId and orgHandler:
   - If selectedOrg is non-null, use selectedOrg.id and selectedOrg.handle — no need to ask the user
   - If selectedOrg is null, call DevantListOrgsTool and ask the user to choose an org
3. For projectHandler:
   - Call DevantListProjectsTool with the resolved orgId to get available projects
   - If switching, show the current project and ask the user to confirm the target
   - Use the chosen project's handler field

**Response Format:**
Returns the updated workspace context:
- isAssociated (boolean): true if association was successful
- selectedOrg: the newly associated organization
- selectedProject: the newly associated project

**Examples:**
User: "Link this workspace to my Payment Service project"
→ DevantGetWorkspaceContextTool → selectedOrg available
→ DevantListProjectsTool with selectedOrg.id
→ DevantAssociateWorkspaceTool with { orgId, orgHandler, projectHandler: "payment-service" }

User: "Switch to a different project"
→ DevantGetWorkspaceContextTool → shows current association
→ DevantListProjectsTool to show available projects
→ User picks → DevantAssociateWorkspaceTool with chosen project's handler
`,
        inputSchema: DevantAssociateWorkspaceSchema,
        execute: async (input: DevantAssociateWorkspaceInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_ASSOCIATE_WORKSPACE_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantAssociateWorkspace(eventHandler, toolCallId, input);
        },
    });
}
