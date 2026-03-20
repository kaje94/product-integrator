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
import { DevantToolEventHandler } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";
import { getGitRoot, getGitRemotes, getGitHead } from "../../../cloud/git/util";

export const DEVANT_GET_GIT_INFO_TOOL = "DevantGetGitInfoTool";

export interface DevantGetGitInfoInput {
    directoryPath?: string;
}

export interface GitRemoteInfo {
    name: string;
    fetchUrl?: string;
    pushUrl?: string;
}

export interface DevantGetGitInfoResult {
    isGitInitialized: boolean;
    workspaceFolderPath?: string;
    rootPath?: string;
    remotes: GitRemoteInfo[];
    branch?: string;
    commit?: string;
}

const DevantGetGitInfoSchema = jsonSchema<DevantGetGitInfoInput>({
    type: "object",
    properties: {
        directoryPath: {
            type: "string",
            description: "Absolute filesystem path of the directory to inspect. Defaults to the VS Code workspace root if omitted.",
        },
    },
    required: [],
});

export async function devantGetGitInfo(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantGetGitInfoInput,
): Promise<DevantGetGitInfoResult> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_GET_GIT_INFO_TOOL,
        toolInput: input,
        toolCallId,
    });

    const directoryPath = input.directoryPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!directoryPath) {
        const result: DevantGetGitInfoResult = { isGitInitialized: false, remotes: [] };
        eventHandler({
            type: "tool_result",
            toolName: DEVANT_GET_GIT_INFO_TOOL,
            toolOutput: result,
            toolCallId,
        });
        return result;
    }

    let rootPath: string | undefined;
    try {
        rootPath = await getGitRoot(ext.context, directoryPath);
    } catch {
        const result: DevantGetGitInfoResult = { isGitInitialized: false, remotes: [] };
        eventHandler({
            type: "tool_result",
            toolName: DEVANT_GET_GIT_INFO_TOOL,
            toolOutput: result,
            toolCallId,
        });
        return result;
    }

    if (!rootPath) {
        const result: DevantGetGitInfoResult = { isGitInitialized: false, remotes: [] };
        eventHandler({
            type: "tool_result",
            toolName: DEVANT_GET_GIT_INFO_TOOL,
            toolOutput: result,
            toolCallId,
        });
        return result;
    }

    const [remotes, head] = await Promise.all([
        getGitRemotes(ext.context, directoryPath),
        getGitHead(ext.context, directoryPath),
    ]);

    const result: DevantGetGitInfoResult = {
        isGitInitialized: true,
        workspaceFolderPath: directoryPath,
        rootPath,
        remotes: remotes.map((r) => ({ name: r.name, fetchUrl: r.fetchUrl, pushUrl: r.pushUrl })),
        branch: head?.name,
        commit: head?.commit,
    };

    console.log(
        `[${DEVANT_GET_GIT_INFO_TOOL}] workspaceFolderPath=${directoryPath}, rootPath=${rootPath}, branch=${result.branch ?? "detached"}, remotes=${result.remotes.map((r) => r.name).join(", ") || "none"}`
    );

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_GET_GIT_INFO_TOOL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createDevantGetGitInfoTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Returns git repository information for the current workspace directory.

**Purpose:**
Detects whether git has been initialized in the workspace and, if so, returns the repository root path, configured remotes, and the currently checked-out branch (or HEAD commit when in detached HEAD state).

**When to use this tool:**
Call this tool before DevantCreateIntegrationTool to resolve the \`repoUrl\` and \`branch\` inputs without reading raw git files manually. It provides a single, reliable source of truth for:
- Whether the workspace is a git repository (\`isGitInitialized\`)
- The git root directory (\`rootPath\`)
- All configured remotes and their URLs (\`remotes\`)
- The current branch name (\`branch\`)

**Response Format:**
Returns an object with:
- \`isGitInitialized\` (boolean): true when the directory is inside a git repository
- \`workspaceFolderPath\` (string | undefined): the resolved absolute path of the workspace folder that was inspected — use this value as \`directoryPath\` when calling DevantListIntegrationsTool
- \`rootPath\` (string | undefined): absolute path to the repository root; undefined if not a git repo
- \`remotes\` (array): list of configured remotes, each with \`name\`, \`fetchUrl\`, and \`pushUrl\`
- \`branch\` (string | undefined): name of the currently checked-out branch; undefined when in detached HEAD state
- \`commit\` (string | undefined): SHA of the current HEAD commit

**How to use the result:**
- \`isGitInitialized\` is false → the workspace is not a git repository; inform the user and stop — do NOT proceed with DevantCreateIntegrationTool
- \`remotes\` is empty → no remotes configured; the repository exists locally but has no remote origin — inform the user that a remote must be added and pushed before deploying
- \`remotes\` has entries → use the \`fetchUrl\` of the \`origin\` remote (or the first remote if \`origin\` is absent) as the \`repoUrl\` for DevantCreateIntegrationTool. Strip credentials and the \`.git\` suffix from the URL.
- \`branch\` is defined → use it as the \`branch\` for DevantCreateIntegrationTool (confirm with the user if they want a different branch)
- \`branch\` is undefined (detached HEAD) → ask the user which branch to use
- \`workspaceFolderPath\` → pass this directly as \`directoryPath\` to DevantListIntegrationsTool to scope results to the current workspace; do NOT construct or guess this path from other sources
`,
        inputSchema: DevantGetGitInfoSchema,
        execute: async (input: DevantGetGitInfoInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_GET_GIT_INFO_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantGetGitInfo(eventHandler, toolCallId, input);
        },
    });
}
