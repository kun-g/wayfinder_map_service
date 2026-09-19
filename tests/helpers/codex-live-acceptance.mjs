// Opt-in installed-Codex acceptance. This is not part of npm test and cannot
// provide L05. Requires authenticated Codex, a private local root and fixed port.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { initializeSQLite } from '../../dist/sqlite-storage.js';
import { createCodexMcpHarness } from './codex-mcp-harness.mjs';

const root = process.env.WAYFINDER_CODEX_TEST_ROOT;
const port = process.env.WAYFINDER_CODEX_TEST_PORT;
const reportPath = process.env.WAYFINDER_CODEX_REPORT;
assert(root && port && reportPath, 'Explicit private root, fixed port and fresh report target required');
const repository = fileURLToPath(new URL('../../', import.meta.url));
const harness = createCodexMcpHarness({ root, directoryPrefix: 'wayfinder-codex-acceptance-', port,
  serverName: 'wayfinder_acceptance', actorId: 'acceptance-operator', clientId: 'codex-live-acceptance' });
const { databasePath: path, protocolPath, env, safe, start, stop } = harness;
const mapId = 'Acceptance.Codex.Workflow';
const author = { actorId: env.WAYFINDER_ACTOR_ID, clientId: env.WAYFINDER_CLIENT_ID };
const sessions = [];
async function codex(label, prompt, resume) {
  const execution = await harness.execute({ label, resume, prompt: 'Use only the four wayfinder_acceptance MCP tools. No shell, browser, other tools or delegation. '
    + 'These are isolated test fixtures, not real project work or a human verdict. Execute the specified operations in order using returned revisions. '
    + 'Stop and report any unexpected rejection. Never automatically replay a write or take over another Claim.\n' + prompt });
  sessions.push(execution.record);
  return execution.record;
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
const known = () => harness.known(mapId);
try {
  initializeSQLite(path); await start();
  const a = await codex('A-workflow', [call('map_list', {}),
    call('map_create', { mapId, title: 'Installed Codex isolated acceptance', destination: 'Prove real M1 workflow through Codex, SQLite and HTTP' }),
    apply(1, [ticket('Prep'), ticket('Next', 'research'), ticket('Handoff'),
      { kind: 'dependency.add', dependentId: 'Next', prerequisiteId: 'Prep' },
      { kind: 'content.add', section: 'fog', item: { id: 'Fog', text: 'Further exploration needs a separate adoption gate', references: [] } },
      { kind: 'content.add', section: 'scopeExclusions', item: { id: 'Scope', text: 'No authority switch in this acceptance', references: [] } }]),
    apply(2, [acquire('Prep', 'codex:A')]), apply(3, [settle('Prep', 'task', 'codex:A')]),
    apply(4, [acquire('Next', 'codex:A')]), apply(5, [settle('Next', 'research', 'codex:A')]),
    apply(6, [{ kind: 'ticket.reopen', ticketId: 'Prep', reason: 'Revisit prerequisite fixture' }, { kind: 'ticket.reopen', ticketId: 'Next', reason: 'Revisit dependent fixture' }]),
    apply(7, [acquire('Prep', 'codex:A')]), read(), ...[1, 2, 3, 4, 5, 6, 7].map(read),
    'Describe the observed Frontier transitions, including Next unlocked at Revision 4, typed Completion/Finding and historical Claims/Settlements. Retain expectedRevision 8 for the next turn. Do not advance beyond 8.'
  ].join('\n'));
  const aData = payloads(a); const writes = aData.filter(item => item.kind === 'committed');
  assert.deepEqual(writes.map(item => typeof item.revision === 'number' ? item.revision : item.revision.revision), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(typeof writes[0].revision, 'number');
  assert.deepEqual(writes.slice(1).map(item => item.frontier), [['Handoff', 'Prep'], ['Handoff'], ['Handoff', 'Next'], ['Handoff'], ['Handoff'], ['Handoff', 'Prep'], ['Handoff']]);
  const state = await known(); assert.equal(state.current.value.currentRevision, 8);
  assert.equal(state.history[2].value.state.tickets.find(t => t.id === 'Prep').claim, 'codex:A');
  assert.equal(state.history[3].value.state.tickets.find(t => t.id === 'Prep').settlement.introducedAtRevision, 4);
  assert.equal(state.history[5].value.state.tickets.find(t => t.id === 'Next').settlement.outcome.kind, 'finding');
  for (const ticket of state.history[6].value.state.tickets) assert(!('settlement' in ticket));
  // Session B gets no Map ID or A transcript: it must discover via catalog.
  const b = await codex('B-independent', 'You are independent session B, claimant codex:B. First map_list, discover the only isolated acceptance Map by catalog and retain its returned stable ID. '
    + 'Read current state. Use the accepted M1 command shapes: acquisition is {kind:"claim.acquire",ticketId:"Handoff",claimantId:"codex:B"}; settlement is {kind:"ticket.settle",ticketId:"Handoff",ticketType:"task",claimantId:"codex:B",settlement:{outcome:{kind:"completion",statement:"Session B continuation finished"},evidence:[],references:[],provenance:{method:"Installed Codex session B fixture",sources:[]},extensions:{}}}. '
    + 'At that returned head claim Handoff with includeSnapshot true, then settle it using the new returned revision and omit includeSnapshot for the compact default receipt. '
    + 'Read current state and report stable ID/head, your distinct Claimant and the retained codex:A Claim. Never create a replacement Map or touch Prep/Next.');
  assert.notEqual(a.threadId, b.threadId);
  assert.equal(b.calls[0].tool, 'map_list'); assert(!b.calls.some(item => item.tool === 'map_create'));
  assert.deepEqual(payloads(b).filter(item => item.kind === 'committed').map(item => typeof item.revision === 'number' ? item.revision : item.revision.revision), [9, 10]);
  const before = await known(); assert.equal(before.current.value.currentRevision, 10);
  const matchReads = session => {
    for (const item of session.calls.filter(item => item.tool === 'map_read' && item.result.structured_content.kind === 'found')) {
      const returned = item.result.structured_content.revision;
      assert.deepEqual(returned, before.history[returned.revision - 1].value, 'Codex full read differs from durable fixture');
    }
  };
  matchReads(a); matchReads(b);
  assert.deepEqual([...new Set(a.calls.map(item => item.tool))].sort(), ['map_apply', 'map_create', 'map_list', 'map_read']);
  const stale = await codex('A-stale-reread', [
    'Your cached expectedRevision is 8. Issue exactly one intentional stale write; a Conflict is expected, not an unexpected rejection.',
    call('map_apply', { mapId, expectedRevision: 8, commands: [{ kind: 'map.update', patch: { notes: 'Stale intention must not publish' } }] }),
    read(), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(read),
    read(11), 'Revision 11 must be revision_not_found. Report actual Conflict heads and latest observed head; do not retry/replay or mutate.'
  ].join('\n'), a.threadId);
  assert.deepEqual(payloads(stale).find(item => item.kind === 'conflict'), { kind: 'conflict', conflict: { mapId, expectedRevision: 8, currentRevision: 10 } });
  assert.deepEqual(await known(), before);
  assert(payloads(stale).some(item => item.code === 'revision_not_found'));
  matchReads(stale);
  await stop(); await start();
  const reconnected = await codex('A-after-service-restart', [read(), ...[3, 4, 5, 6, 8, 9, 10].map(read), read(11),
    'Read-only reconnect proof: current head must be 10, Prep retains codex:A, historical Claims/Settlements remain unchanged, and 11 remains absent. No expiry, takeover, write or human verdict.'
  ].join('\n'), a.threadId);
  assert(reconnected.calls.every(item => item.tool === 'map_read'));
  assert.equal(payloads(reconnected)[0].revision.revision, 10);
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
    serverCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
    installedClient: execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim(), node: process.version, sqliteVersion,
    sdk: '1.30.0', protocolVersions: [...new Set(protocols)], mapId, sessions,
    assertions: ['once-only schema-valid compact/snapshot results', 'Frontier/Claim/Completion/Finding/explicit reopen/history',
      'independent B catalog discovery/stable ID/distinct claimant continuation', 'A stale Conflict/current reread/full unchanged known history/next absence',
      'service SIGTERM/restart and actual Codex reconnect retain head/history/Claims'], humanVerdict: null };
  safe(report); writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('L01–L04 actual installed-Codex assertions passed; L05 requires a live human verdict');
} finally {
  await stop();
  harness.cleanup();
}
