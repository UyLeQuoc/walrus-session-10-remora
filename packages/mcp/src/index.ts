/**
 * @remora/mcp: Remora as an MCP server. v2 (F14, ADR-0066) proxies stdio to the server's /mcp with a
 * token; v1 (F9) is the read-only session server: remoras_list, remora_recall, wake_get.
 */
export { createProxy, type ProxyOptions, runProxyStdio } from "./proxy.ts";
export { createMcpServer, type McpOptions, PROTOCOL_VERSIONS, runStdio, TOOLS } from "./server.ts";
