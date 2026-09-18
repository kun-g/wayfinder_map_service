// Passive, test-only observation of initialize responses from the real service.
// Never record request bodies, headers, paths, credentials or business responses.
import { ServerResponse } from 'node:http';
import { appendFileSync } from 'node:fs';
const end = ServerResponse.prototype.end;
ServerResponse.prototype.end = function (chunk, ...args) {
  if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
    try {
      const message = JSON.parse(String(chunk));
      if (message.result?.protocolVersion && process.env.WAYFINDER_PROTOCOL_REPORT) {
        appendFileSync(process.env.WAYFINDER_PROTOCOL_REPORT, JSON.stringify({ protocolVersion: message.result.protocolVersion }) + '\n', { mode: 0o600 });
      }
    } catch { /* Ordinary non-initialize responses are ignored. */ }
  }
  return end.call(this, chunk, ...args);
};
