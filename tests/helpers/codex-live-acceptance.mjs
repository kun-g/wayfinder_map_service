// Opt-in installed-Codex acceptance. This is not part of npm test and cannot
// provide L05. Requires authenticated Codex, a private local root and fixed port.
import assert from 'node:assert/strict';
import { fork, spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { initializeSQLite, openSQLite } from '../../dist/sqlite-storage.js';
import { mapTools } from '../../dist/mcp-tools.js';
import { Ajv } from 'ajv';

const root = process.env.WAYFINDER_CODEX_TEST_ROOT;
const port = process.env.WAYFINDER_CODEX_TEST_PORT;
const reportPath = process.env.WAYFINDER_CODEX_REPORT;
assert(root && port && reportPath, 'Explicit private root, fixed port and fresh report target required');
assert(/^[1-9][0-9]{0,4}$/.test(port) && Number(port) <= 65535, 'Invalid fixed port');
const directory = realpathSync(mkdtempSync(join(root, 'wayfinder-codex-acceptance-')));
const control = realpathSync(mkdtempSync(join(tmpdir(), 'wayfinder-codex-control-')));
const path = join(directory, 'private', 'maps.sqlite');
const protocolPath = join(control, 'protocol.jsonl');
const token = randomBytes(32).toString('hex');
const env = { ...process.env, WAYFINDER_DATABASE_PATH: path, WAYFINDER_PORT: port,
  WAYFINDER_TOKEN: token, WAYFINDER_ACTOR_ID: 'acceptance-operator', WAYFINDER_CLIENT_ID: 'codex-live-acceptance',
  WAYFINDER_ALLOWED_ORIGINS: '[]', WAYFINDER_PROTOCOL_REPORT: protocolPath };
const mapId = 'Acceptance.Codex.Workflow';
const author = { actorId: env.WAYFINDER_ACTOR_ID, clientId: env.WAYFINDER_CLIENT_ID };
const schemas = new Map(mapTools.map(tool => [tool.name, new Ajv({ strict: false }).compile(tool.outputSchema)]));
const sessions = [];
let host;
function safe(value) {
  const text = JSON.stringify(value);
  for (const secret of [token, directory, control, path]) assert(!text.includes(secret), 'Sensitive material in evidence');
}
async function start() {
  const child = fork(fileURLToPath(new URL('../../dist/mcp-start.js', import.meta.url)), [], {
    execArgv: ['--import', fileURLToPath(new URL('./codex-acceptance-observer.mjs', import.meta.url))],
    env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
  let logs = '';
  const ready = new Promise(resolve => {
    child.stdout.on('data', data => { logs += data; if (logs.includes('Wayfinder local MCP ready')) resolve(); });
    child.stderr.on('data', data => { logs += data; });
  });
  host = { child, exit, logs: () => logs };
  await Promise.race([ready, exit.then(() => { throw new Error('Service startup failed'); })]);
}
async function stop() {
  if (!host) return;
  const current = host; host = undefined;
  current.child.kill('SIGTERM'); assert.deepEqual(await current.exit, { code: 0, signal: null }); safe(current.logs());
}
const configuration = ['--ignore-user-config', '--json', '--skip-git-repo-check',
  '-c', `mcp_servers.wayfinder_acceptance.url="http://127.0.0.1:${port}/mcp"`,
  '-c', 'mcp_servers.wayfinder_acceptance.bearer_token_env_var="WAYFINDER_TOKEN"',
  // The user authorized these four isolated acceptance tools. This applies to
  // this process only; shell remains read-only and user config is untouched.
  '-c', 'mcp_servers.wayfinder_acceptance.default_tools_approval_mode="approve"'];
async function codex(label, prompt, resume) {
  const args = resume ? ['exec', 'resume', ...configuration, resume, '-']
    : ['exec', ...configuration, '-C', control, '-s', 'read-only', '-'];
  const child = spawn('codex', args, { env, cwd: control, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdin.end('Use only the four wayfinder_acceptance MCP tools. No shell, browser, other tools or delegation. '
    + 'These are isolated test fixtures, not real project work or a human verdict. Execute the specified operations in order using returned revisions. '
    + 'Stop and report any unexpected rejection. Never automatically replay a write or take over another Claim.\n' + prompt);
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(code, 0, 'Codex process failed');
  safe(stderr);
  const events = stdout.trim().split('\n').map(line => JSON.parse(line));
  assert(events.some(event => event.type === 'turn.completed'), 'Codex turn incomplete');
  const items = events.filter(event => event.type === 'item.completed').map(event => event.item);
  assert(items.every(item => ['agent_message', 'mcp_tool_call'].includes(item.type)), 'Unexpected non-MCP operation');
  const calls = items.filter(item => item.type === 'mcp_tool_call');
  assert(calls.length > 0, 'No actual Codex tool calls');
  for (const call of calls) {
    assert.equal(call.server, 'wayfinder_acceptance'); assert.equal(call.error, null);
    assert.deepEqual(call.result.content, []);
    assert(schemas.get(call.tool)?.(call.result.structured_content), 'Codex result violates output schema');
    // Codex JSONL exposes the error envelope as call status; its result
    // projection retains content/structured_content but omits isError.
    assert.equal(call.status === 'failed', !['found', 'listed', 'committed'].includes(call.result.structured_content.kind));
  }
  const session = { label, threadId: events.find(event => event.type === 'thread.started')?.thread_id ?? resume,
    calls: calls.map(({ tool, arguments: args, result, status }) => ({ tool, arguments: args, result, status })),
    finalMessage: items.filter(item => item.type === 'agent_message').at(-1)?.text };
  safe(session); sessions.push(session);
  console.log(`Installed Codex ${label}: ${calls.length} real MCP calls completed`);
  return session;
}
const ticket = (id, type = 'task') => ({ kind: 'ticket.create', ticket: { id, title: id, question: `Verify ${id}?`, type } });
const acquire = (ticketId, claimantId) => ({ kind: 'claim.acquire', ticketId, claimantId });
const settle = (ticketId, ticketType, claimantId) => ({ kind: 'ticket.settle', ticketId, ticketType, claimantId, settlement: {
  outcome: ticketType === 'research' ? { kind: 'finding', statement: 'Installed Codex consumed structured results', limitations: 'Isolated local workflow only' }
    : { kind: 'completion', statement: `${ticketId} fixture finished`, resultingFacts: { observed: true } },
  evidence: [], references: [{ locator: 'fixture:codex-acceptance', label: 'Isolated fixture' }],
  provenance: { method: 'Installed Codex acceptance fixture', sources: [] }, extensions: {},
} });
const call = (name, args) => `${name} ${JSON.stringify(args)}`;
const apply = (expectedRevision, commands) => call('map_apply', { mapId, expectedRevision, commands, includeSnapshot: true });
const read = revision => call('map_read', { mapId, ...(revision === undefined ? {} : { revision }) });
const payloads = session => session.calls.map(item => item.result.structured_content);
async function known() {
  const storage = openSQLite(path);
  try {
    const current = await storage.adapter.readCurrent(mapId);
    assert.equal(current.kind, 'found');
    const history = await Promise.all(Array.from({ length: current.value.currentRevision }, (_, i) => storage.adapter.readRevision(mapId, i + 1)));
    assert(history.every(item => item.kind === 'found'));
    return { current, history, catalog: storage.listMaps(), next: await storage.adapter.readRevision(mapId, current.value.currentRevision + 1) };
  } finally { storage.close(); }
}
try {
  initializeSQLite(path); await start();
  const a = await codex('A-workflow', [call('map_list', {}),
    call('map_create', { mapId, title: 'Installed Codex isolated acceptance', destination: 'Prove real M1 workflow through Codex, SQLite and HTTP' }),
    apply(1, [ticket('Prep'), ticket('Next', 'research'), ticket('Handoff'),
      { kind: 'dependency.add', dependentId: 'Next', prerequisiteId: 'Prep' },
      { kind: 'content.add', section: 'fog', item: { id: 'Fog', text: 'Further exploration needs a separate adoption gate', references: [] } },
      { kind: 'content.add', section: 'scopeExclusions', item: { id: 'Scope', text: 'No authority switch in this acceptance', references: [] } }]),
    apply(2, [acquire('Prep', 'codex:A')]), apply(3, [settle('Prep', 'task', 'codex:A'), acquire('Next', 'codex:A')]),
    apply(4, [settle('Next', 'research', 'codex:A')]),
    apply(5, [{ kind: 'ticket.reopen', ticketId: 'Prep', reason: 'Revisit prerequisite fixture' }, { kind: 'ticket.reopen', ticketId: 'Next', reason: 'Revisit dependent fixture' }]),
    apply(6, [acquire('Prep', 'codex:A')]), read(), ...[1, 2, 3, 4, 5, 6].map(read),
    'Describe the observed Frontier transitions, typed Completion/Finding and historical Claims/Settlements. Retain expectedRevision 7 for the next turn. Do not advance beyond 7.'
  ].join('\n'));
  const aData = payloads(a); const writes = aData.filter(item => item.kind === 'committed');
  assert.deepEqual(writes.map(item => typeof item.revision === 'number' ? item.revision : item.revision.revision), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(typeof writes[0].revision, 'number');
  assert.deepEqual(writes.slice(1).map(item => item.frontier), [['Handoff', 'Prep'], ['Handoff'], ['Handoff'], ['Handoff'], ['Handoff', 'Prep'], ['Handoff']]);
  let state = await known(); assert.equal(state.current.value.currentRevision, 7);
  assert.equal(state.history[2].value.state.tickets.find(t => t.id === 'Prep').claim, 'codex:A');
  assert.equal(state.history[3].value.state.tickets.find(t => t.id === 'Prep').settlement.introducedAtRevision, 4);
  assert.equal(state.history[4].value.state.tickets.find(t => t.id === 'Next').settlement.outcome.kind, 'finding');
  for (const ticket of state.history[5].value.state.tickets) assert(!('settlement' in ticket));
  // Session B gets no Map ID or A transcript: it must discover via catalog.
  const b = await codex('B-independent', 'You are independent session B, claimant codex:B. First map_list, discover the only isolated acceptance Map by catalog and retain its returned stable ID. '
    + 'Read current state. Use the accepted M1 command shapes: acquisition is {kind:"claim.acquire",ticketId:"Handoff",claimantId:"codex:B"}; settlement is {kind:"ticket.settle",ticketId:"Handoff",ticketType:"task",claimantId:"codex:B",settlement:{outcome:{kind:"completion",statement:"Session B continuation finished"},evidence:[],references:[],provenance:{method:"Installed Codex session B fixture",sources:[]},extensions:{}}}. '
    + 'At that returned head claim Handoff with includeSnapshot true, then settle it using the new returned revision and omit includeSnapshot for the compact default receipt. '
    + 'Read current state and report stable ID/head, your distinct Claimant and the retained codex:A Claim. Never create a replacement Map or touch Prep/Next.');
  assert.notEqual(a.threadId, b.threadId);
  assert.equal(b.calls[0].tool, 'map_list'); assert(!b.calls.some(item => item.tool === 'map_create'));
  assert.deepEqual(payloads(b).filter(item => item.kind === 'committed').map(item => typeof item.revision === 'number' ? item.revision : item.revision.revision), [8, 9]);
  const before = await known(); assert.equal(before.current.value.currentRevision, 9);
  const matchReads = session => {
    for (const item of session.calls.filter(item => item.tool === 'map_read' && item.result.structured_content.kind === 'found')) {
      const returned = item.result.structured_content.revision;
      assert.deepEqual(returned, before.history[returned.revision - 1].value, 'Codex full read differs from durable fixture');
    }
  };
  matchReads(a); matchReads(b);
  assert.deepEqual([...new Set(a.calls.map(item => item.tool))].sort(), ['map_apply', 'map_create', 'map_list', 'map_read']);
  const stale = await codex('A-stale-reread', [
    'Your cached expectedRevision is 7. Issue exactly one intentional stale write; a Conflict is expected, not an unexpected rejection.',
    call('map_apply', { mapId, expectedRevision: 7, commands: [{ kind: 'map.update', patch: { notes: 'Stale intention must not publish' } }] }),
    read(), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(read),
    read(10), 'Revision 10 must be revision_not_found. Report actual Conflict heads and latest observed head; do not retry/replay or mutate.'
  ].join('\n'), a.threadId);
  assert.deepEqual(payloads(stale).find(item => item.kind === 'conflict'), { kind: 'conflict', conflict: { mapId, expectedRevision: 7, currentRevision: 9 } });
  assert.deepEqual(await known(), before);
  assert(payloads(stale).some(item => item.code === 'revision_not_found'));
  matchReads(stale);
  await stop(); await start();
  const reconnected = await codex('A-after-service-restart', [read(), ...[3, 4, 5, 7, 8, 9].map(read), read(10),
    'Read-only reconnect proof: current head must be 9, Prep retains codex:A, historical Claims/Settlements remain unchanged, and 10 remains absent. No expiry, takeover, write or human verdict.'
  ].join('\n'), a.threadId);
  assert(reconnected.calls.every(item => item.tool === 'map_read'));
  assert.equal(payloads(reconnected)[0].revision.revision, 9);
  assert.equal(payloads(reconnected)[0].revision.state.tickets.find(t => t.id === 'Prep').claim, 'codex:A');
  assert.deepEqual(await known(), before);
  matchReads(reconnected);
  for (const item of before.history) {
    assert.equal(item.value.author.actorId, author.actorId); assert.equal(item.value.author.clientId, author.clientId);
    assert.equal(item.value.priorRevision, item.value.revision === 1 ? null : item.value.revision - 1);
  }
  await stop();
  const db = new DatabaseSync(':memory:'); const sqliteVersion = db.prepare('select sqlite_version() as version').get().version; db.close();
  const protocols = readFileSync(protocolPath, 'utf8').trim().split('\n').map(line => JSON.parse(line).protocolVersion);
  assert(protocols.length >= 4, 'Actual initialize negotiation not observed');
  const report = { status: 'L01-L04 passed; L05 pending live human verdict',
    serverCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8' }).trim(),
    installedClient: execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim(), node: process.version, sqliteVersion,
    sdk: '1.30.0', protocolVersions: [...new Set(protocols)], mapId, sessions,
    assertions: ['once-only schema-valid compact/snapshot results', 'Frontier/Claim/Completion/Finding/explicit reopen/history',
      'independent B catalog discovery/stable ID/distinct claimant continuation', 'A stale Conflict/current reread/full unchanged known history/next absence',
      'service SIGTERM/restart and actual Codex reconnect retain head/history/Claims'], humanVerdict: null };
  safe(report); writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('L01–L04 actual installed-Codex assertions passed; L05 requires a live human verdict');
} finally {
  await stop();
  rmSync(directory, { recursive: true }); rmSync(control, { recursive: true });
}
