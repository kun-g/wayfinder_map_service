import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
export function createHttpTestClient(port: number, token: string): Promise<{
  client: Client;
  negotiatedProtocol: string;
  transport: { readonly sessionId: string | undefined; terminateSession(): Promise<void> };
}>;
