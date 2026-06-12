/**
 * MCP Client Service
 * Implements the Model Context Protocol SSE transport (spec 2024-11-05)
 * Stateless: each operation opens a connection, performs the task, and closes.
 */
export interface MCPToolInfo {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export interface MCPToolResult {
    content: string;
    isError: boolean;
}
/**
 * Connect to an MCP server and retrieve the list of available tools.
 *
 * `extraHeaders` are sent on every underlying HTTP request (SSE GET, JSON-RPC POST,
 * notification POST). Use for per-tenant auth headers (e.g. X-MCP-API-Key) and
 * GenSmart's auto-injected identity headers (X-Agent-ID, X-Session-ID,
 * X-Webhook-Secret). See docs/INTEGRATION.md §3.
 */
export declare function connectAndListTools(serverUrl: string, transport?: 'sse' | 'streamable-http', extraHeaders?: Record<string, string>): Promise<MCPToolInfo[]>;
/**
 * Execute a tool on an MCP server.
 *
 * `extraHeaders` are sent on every underlying HTTP request — see `connectAndListTools`.
 */
export declare function executeMCPTool(serverUrl: string, toolName: string, toolArguments: Record<string, unknown>, transport?: 'sse' | 'streamable-http', extraHeaders?: Record<string, string>): Promise<MCPToolResult>;
/**
 * Sanitize a string to be safe as part of a tool name (LLM tool names: [a-zA-Z0-9_-])
 */
export declare function sanitizeName(name: string): string;
//# sourceMappingURL=mcp-client.service.d.ts.map