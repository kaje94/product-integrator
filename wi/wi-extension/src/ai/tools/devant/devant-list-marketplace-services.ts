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
import { DevantToolEventHandler, MarketplaceListResp } from "@wso2/wso2-platform-core";
import { ext } from "../../../extensionVariables";

export const DEVANT_LIST_MARKETPLACE_SERVICES_TOOL = "DevantListMarketplaceServicesTool";

export interface DevantListMarketplaceServicesInput {
    orgId: string;
    projectId?: string;
    query?: string;
    isThirdParty?: boolean;
}

const DevantListMarketplaceServicesSchema = jsonSchema<DevantListMarketplaceServicesInput>({
    type: "object",
    properties: {
        orgId: {
            type: "string",
            description: "Numeric ID of the organization. Obtain from DevantGetWorkspaceContextTool (selectedOrg.id) or DevantListOrgsTool.",
        },
        projectId: {
            type: "string",
            description: "Numeric ID of the project. Obtain from DevantGetWorkspaceContextTool (selectedProject.id) or DevantListProjectsTool.",
        },
        query: {
            type: "string",
            description: "Optionally filter services by name, description, summary, or IDL content.",
        },
        isThirdParty: {
            type: "boolean",
            description: "Optionally filter by whether the service is third-party. Omit to return all services.",
        },
    },
    required: ["orgId", "projectId"],
});

export async function devantListMarketplaceServices(
    eventHandler: DevantToolEventHandler,
    toolCallId: string,
    input: DevantListMarketplaceServicesInput,
): Promise<MarketplaceListResp> {
    eventHandler({
        type: "tool_call",
        toolName: DEVANT_LIST_MARKETPLACE_SERVICES_TOOL,
        toolInput: input,
        toolCallId,
    });

    let result: MarketplaceListResp
    try {
        result = await ext.clients.rpcClient.getMarketplaceItems({
            orgId: input.orgId,
            request: {
                query: input.query ?? "",
                networkVisibilityFilter: "all",
                networkVisibilityprojectId: input.projectId,
                // isThirdParty: input.isThirdParty,
                sortBy: "createdTime",
                limit: 100,
                offset: 0,
            },
        });
    } catch (err) {
        throw new Error(`Failed to retrieve marketplace services: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`[${DEVANT_LIST_MARKETPLACE_SERVICES_TOOL}] Returning ${result?.data?.length ?? 0} marketplace services"`);

    eventHandler({
        type: "tool_result",
        toolName: DEVANT_LIST_MARKETPLACE_SERVICES_TOOL,
        toolOutput: result,
        toolCallId,
    });

    return result;
}

export function createDevantListMarketplaceServicesTool(eventHandler: DevantToolEventHandler) {
    return tool({
        description: `Retrieves marketplace services available to an organization in Devant.

**Purpose:**
Returns a paginated list of marketplace services (REST, GraphQL, GRPC, SOAP, ASYNC_API) and database resources that are accessible to the organization. Services can be filtered by search query, network visibility, or third-party status.

**When to use this tool:**
- When the user asks to see available marketplace services or APIs
- When the user wants to discover services to connect to their integration
- When the user wants to browse or search for specific service types

**Prerequisites:**
Call DevantGetWorkspaceContextTool first to obtain \`orgId\` (selectedOrg.id) and \`projectId\` (selectedProject.id).

**Filtering:**
- Use \`query\` to search by name, description, summary, or IDL
- Use \`isThirdParty\` to include or exclude third-party services

**Response Format:**
Returns an object containing:
- \`count\`: Total number of matching services
- \`pagination\`: Pagination metadata
- \`data\`: Array of marketplace service objects, each containing:
  - \`serviceId\`: Unique identifier for the service
  - \`name\`: Service name
  - \`version\`: Service version
  - \`serviceType\`: Protocol type (REST, GRPC, GRAPHQL, SOAP, ASYNC_API)
  - \`resourceType\`: Resource category (SERVICE or DATABASE)
  - \`status\`: Publication status (PUBLISHED, DEPRECATED, PROTOTYPE)
  - \`summary\`: Short description
  - \`description\`: Detailed description
  - \`visibility\`: Visibility levels (PUBLIC, ORGANIZATION, PROJECT)
  - \`connectionSchemas\`: Available connection schema definitions
`,
        inputSchema: DevantListMarketplaceServicesSchema,
        execute: async (input: DevantListMarketplaceServicesInput, context?: { toolCallId?: string }) => {
            const toolCallId = context?.toolCallId || `fallback-${Date.now()}`;
            console.log(`[${DEVANT_LIST_MARKETPLACE_SERVICES_TOOL}] Called [toolCallId: ${toolCallId}]`);
            return await devantListMarketplaceServices(eventHandler, toolCallId, input);
        },
    });
}
