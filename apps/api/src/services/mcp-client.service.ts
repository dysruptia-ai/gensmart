/**
 * MCP Client Service
 * Implements the Model Context Protocol SSE transport (spec 2024-11-05)
 * Stateless: each operation opens a connection, performs the task, and closes.
 */

import http from 'http';
import https from 'https';
import { env } from '../config/env';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  content: string;
  isError: boolean;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONNECT_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;

// ── HTTP helper ───────────────────────────────────────────────────────────────

function postJson(url: string, body: unknown): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const payload = JSON.stringify(body);

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        // Drain response body
        res.resume();
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 200 }));
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── SSE session ───────────────────────────────────────────────────────────────

/**
 * Open an SSE connection to the MCP server, run `operation`, then close.
 * The operation receives `send` (JSON-RPC request) and `notify` (JSON-RPC notification).
 */
async function withMCPSession<T>(
  serverUrl: string,
  operation: (
    send: (method: string, params?: unknown) => Promise<unknown>
  ) => Promise<T>
): Promise<T> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error(`Invalid MCP server URL: ${serverUrl}`);
  }

  // Only allow HTTPS in production (allow HTTP for localhost dev)
  if (
    parsed.protocol !== 'https:' &&
    !(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
    env.NODE_ENV !== 'development'
  ) {
    throw new Error('MCP server URL must use HTTPS');
  }

  const isHttps = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;

  let postEndpoint: string | null = null;
  let reqCounter = 0;
  const pending = new Map<
    number,
    { resolve: (r: unknown) => void; reject: (e: Error) => void }
  >();
  // Use a ref object so TypeScript doesn't narrow it to `never` via CFA
  const sseRef: { req: http.ClientRequest | null } = { req: null };

  // ── Open SSE stream and wait for `endpoint` event ──
  await new Promise<void>((resolve, reject) => {
    const connectTimer = setTimeout(() => {
      sseRef.req?.destroy();
      reject(new Error('MCP server connection timeout (15s)'));
    }, CONNECT_TIMEOUT_MS);

    sseRef.req = (transport.request as typeof http.request)(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          clearTimeout(connectTimer);
          sseRef.req?.destroy();
          reject(new Error(`MCP server returned HTTP ${res.statusCode}`));
          return;
        }

        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');

          // SSE events are separated by double newline
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            if (!part.trim()) continue;

            let eventType = 'message';
            let data = '';

            for (const line of part.split('\n')) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                data = line.slice(5).trim();
              }
            }

            if (!data) continue;

            if (eventType === 'endpoint') {
              // Resolve endpoint URL (may be relative path)
              try {
                postEndpoint = new URL(data, serverUrl).href;
              } catch {
                postEndpoint = data;
              }
              clearTimeout(connectTimer);
              resolve();
            } else if (eventType === 'message') {
              try {
                const msg = JSON.parse(data) as JsonRpcResponse;
                if (msg.id !== undefined) {
                  const handler = pending.get(msg.id);
                  if (handler) {
                    pending.delete(msg.id);
                    if (msg.error) {
                      handler.reject(new Error(msg.error.message));
                    } else {
                      handler.resolve(msg.result);
                    }
                  }
                }
              } catch {
                // ignore JSON parse errors in SSE data
              }
            }
          }
        });

        res.on('error', (err: Error) => {
          clearTimeout(connectTimer);
          reject(err);
        });

        res.on('close', () => {
          for (const [, h] of pending) {
            h.reject(new Error('SSE connection closed unexpectedly'));
          }
          pending.clear();
        });
      }
    );

    sseRef.req.on('error', (err: Error) => {
      clearTimeout(connectTimer);
      reject(err);
    });

    sseRef.req.end();
  });

  // ── JSON-RPC helpers ──

  async function send(method: string, params?: unknown): Promise<unknown> {
    if (!postEndpoint) throw new Error('Not connected to MCP server');

    const id = ++reqCounter;

    const responsePromise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timeout: ${method} (30s)`));
      }, REQUEST_TIMEOUT_MS);

      pending.set(id, {
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });

    await postJson(postEndpoint, { jsonrpc: '2.0', id, method, params });

    return responsePromise;
  }

  async function notify(method: string, params?: unknown): Promise<void> {
    if (!postEndpoint) throw new Error('Not connected to MCP server');
    await postJson(postEndpoint, { jsonrpc: '2.0', method, params });
  }

  try {
    // Initialize MCP session
    await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'GenSmart', version: '1.0.0' },
    });

    // Send initialized notification (no response expected)
    await notify('notifications/initialized', {});

    return await operation(send);
  } finally {
    sseRef.req?.destroy();
    // Reject any remaining pending requests
    for (const [, h] of pending) {
      h.reject(new Error('MCP session closed'));
    }
    pending.clear();
  }
}

// ── Streamable HTTP session ───────────────────────────────────────────────────

/**
 * Streamable HTTP transport (spec 2025-03-26).
 * Uses a single endpoint for all communication via POST.
 * Server may respond with JSON or SSE stream.
 */
async function withStreamableHTTPSession<T>(
  serverUrl: string,
  operation: (
    send: (method: string, params?: unknown) => Promise<unknown>
  ) => Promise<T>
): Promise<T> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error(`Invalid MCP server URL: ${serverUrl}`);
  }

  if (
    parsed.protocol !== 'https:' &&
    !(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
    env.NODE_ENV !== 'development'
  ) {
    throw new Error('MCP server URL must use HTTPS');
  }

  let sessionId: string | null = null;
  let reqCounter = 0;

  async function send(method: string, params?: unknown): Promise<unknown> {
    const id = ++reqCounter;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`MCP server returned HTTP ${response.status}: ${errText}`);
      }

      // Capture session ID from response headers
      const newSessionId = response.headers.get('mcp-session-id');
      if (newSessionId) {
        sessionId = newSessionId;
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream')) {
        // SSE response — read body stream incrementally (some servers keep the stream open)
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No readable body in SSE response');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events (separated by double newline)
            const events = buffer.split('\n\n');
            buffer = events.pop() ?? ''; // keep incomplete event in buffer

            for (const event of events) {
              if (!event.trim()) continue;

              let data = '';
              for (const line of event.split('\n')) {
                if (line.startsWith('data:')) {
                  data += line.slice(5).trim();
                }
              }

              if (!data) continue;

              try {
                const msg = JSON.parse(data) as JsonRpcResponse;
                if (msg.id === id) {
                  reader.cancel().catch(() => {}); // close the stream
                  if (msg.error) {
                    throw new Error(msg.error.message);
                  }
                  return msg.result;
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue; // skip non-JSON
                throw e;
              }
            }
          }
        } finally {
          reader.cancel().catch(() => {});
        }

        // Also check remaining buffer
        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              try {
                const msg = JSON.parse(data) as JsonRpcResponse;
                if (msg.id === id) {
                  if (msg.error) throw new Error(msg.error.message);
                  return msg.result;
                }
              } catch {
                // ignore
              }
            }
          }
        }

        throw new Error('No matching JSON-RPC response found in SSE stream');
      } else {
        // Direct JSON response
        const msg = (await response.json()) as JsonRpcResponse;
        if (msg.error) {
          throw new Error(msg.error.message);
        }
        return msg.result;
      }
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError') {
        throw new Error(`MCP request timeout: ${method} (30s)`);
      }
      throw err;
    }
  }

  async function notify(method: string, params?: unknown): Promise<void> {
    const notifyBody = JSON.stringify({ jsonrpc: '2.0', method, params });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    try {
      await fetch(serverUrl, {
        method: 'POST',
        headers,
        body: notifyBody,
      });
    } catch {
      // Notifications don't require a response
    }
  }

  // Initialize
  await send('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'GenSmart', version: '1.0.0' },
  });

  await notify('notifications/initialized', {});

  return await operation(send);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Connect to an MCP server and retrieve the list of available tools.
 */
export async function connectAndListTools(
  serverUrl: string,
  transport: 'sse' | 'streamable-http' = 'sse'
): Promise<MCPToolInfo[]> {
  console.log(`[MCP] Connecting to ${serverUrl} via ${transport} to list tools`);

  const withSession = transport === 'streamable-http' ? withStreamableHTTPSession : withMCPSession;

  const result = await withSession(serverUrl, async (send) => {
    return send('tools/list', {});
  });

  type ListResult = {
    tools?: Array<{
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }>;
  };

  const listResult = result as ListResult;
  const tools = listResult?.tools ?? [];

  console.log(`[MCP] Retrieved ${tools.length} tools from ${serverUrl}`);

  return tools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
  }));
}

/**
 * Execute a tool on an MCP server.
 */
export async function executeMCPTool(
  serverUrl: string,
  toolName: string,
  toolArguments: Record<string, unknown>,
  transport: 'sse' | 'streamable-http' = 'sse'
): Promise<MCPToolResult> {
  console.log(`[MCP] Executing tool "${toolName}" on ${serverUrl} via ${transport}`);

  const withSession = transport === 'streamable-http' ? withStreamableHTTPSession : withMCPSession;

  try {
    const result = await withSession(serverUrl, async (send) => {
      return send('tools/call', { name: toolName, arguments: toolArguments });
    });

    type CallResult = {
      content?: Array<{ type: string; text?: string }> | string;
      isError?: boolean;
    };

    const res = result as CallResult;
    let content = '';

    if (typeof res?.content === 'string') {
      content = res.content;
    } else if (Array.isArray(res?.content)) {
      content = res.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n');
    } else if (result !== null && result !== undefined) {
      content = JSON.stringify(result);
    }

    console.log(`[MCP] Tool "${toolName}" executed successfully`);
    return { content: content || '(no output)', isError: res?.isError === true };
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[MCP] Tool "${toolName}" execution failed: ${message}`);
    return {
      content: `MCP tool execution failed: ${message}`,
      isError: true,
    };
  }
}

/**
 * Sanitize a string to be safe as part of a tool name (LLM tool names: [a-zA-Z0-9_-])
 */
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
