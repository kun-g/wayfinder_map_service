// Opt-in installed-Codex proof for the adopted Wayfinder workflow. This is not
// part of npm test. It uses a fresh private database and process-local MCP config.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { initializeSQLite } from '../../dist/sqlite-storage.js';
import { createCodexMcpHarness } from './codex-mcp-harness.mjs';

const root = process.env.WAYFINDER_ADOPTION_TEST_ROOT;
const port = process.env.WAYFINDER_ADOPTION_TEST_PORT;
const reportPath = process.env.WAYFINDER_ADOPTION_REPORT;
assert(root && port && reportPath, 'Explicit private root, fixed port and fresh report target required');
const repository = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const harness = createCodexMcpHarness({ root, directoryPrefix: 'wayfinder-adoption-', port, serverName: 'wayfinder',
  actorId: 'adoption-operator', clientId: 'codex-wayfinder-adoption', workingDirectory: repository, startupTimeoutSeconds: 5 });
const { databasePath, protocolPath } = harness;
const mapId = 'Adoption.NewExploration.20260919';
const title = 'Adoption proof: primary-source evaluation';
const sessions = [];
const { safe, start, stop } = harness;

async function codex(label, prompt, resume) {
  const execution = await harness.execute({ label, resume, prompt: '$wayfinder\nFollow the project-local new-exploration MCP workflow. Use only the four wayfinder MCP tools for Map state; '
    + 'do not use shell, browser, other tools or delegation. This is isolated real workflow evidence. Retain returned revisions, stop on unexpected failure, '
    + 'and never replay, merge or take over automatically.\n' + prompt });
  sessions.push(execution.record);
  return execution.record;
}

async function unavailable() {
  const execution = await harness.execute({ label: 'authority-unavailable', expectSuccess: false, requireCalls: false,
    allowedCompletedItemTypes: ['agent_message'], prompt: '$wayfinder\nResume the adopted exploration Map. '
      + 'The required authority is unavailable, so pause. Do not use any fallback or other tool.' });
  assert.notEqual(execution.code, 0, 'Required unavailable MCP server must fail the turn');
  return { label: 'authority-unavailable', exitCode: execution.code, mcpCalls: execution.calls.length,
    fallbackOperations: execution.items.filter(item => item.type !== 'agent_message').length };
}

const call = (name, args) => `${name} ${JSON.stringify(args)}`;
const apply = (expectedRevision, commands) => call('map_apply', { mapId, expectedRevision, commands, includeSnapshot: true });
const acquire = (ticketId, claimantId) => ({ kind: 'claim.acquire', ticketId, claimantId });
const payloads = session => session.calls.map(item => item.result.structured_content);

const known = () => harness.known(mapId);

try {
  initializeSQLite(databasePath);
  await start();
  const a = await codex('A-chart-and-research', [
    call('map_list', {}),
    call('map_create', { mapId, title, destination: 'Decide whether primary-source evaluation is ready for implementation',
      notes: 'New exploration uses the project-local Wayfinder MCP workflow as sole authority.' }),
    apply(1, [
      { kind: 'ticket.create', ticket: { id: 'SourceReview', title: 'Review primary sources', question: 'What do primary sources establish?', type: 'research' } },
      { kind: 'ticket.create', ticket: { id: 'Synthesis', title: 'Synthesize readiness', question: 'Is the evidence ready for implementation?', type: 'task' } },
      { kind: 'dependency.add', dependentId: 'Synthesis', prerequisiteId: 'SourceReview' },
      { kind: 'content.add', section: 'fog', item: { id: 'FollowOn', text: 'A later question may emerge from the source review', references: [] } },
      { kind: 'content.add', section: 'scopeExclusions', item: { id: 'LegacyMigration', text: 'Do not migrate existing GitHub planning Maps', references: [] } },
    ]),
    apply(2, [acquire('SourceReview', 'adoption:A')]),
    apply(3, [
      { kind: 'ticket.settle', ticketId: 'SourceReview', ticketType: 'research', claimantId: 'adoption:A', settlement: {
        outcome: { kind: 'finding', statement: 'Primary-source evidence is sufficient for the isolated adoption proof', limitations: 'Evidence covers the local workflow only' },
        evidence: [], references: [{ locator: 'docs/spec/mcp-sqlite.md#12-live-codex-evidence-and-adoption-gate', label: 'Accepted adoption gate' }],
        provenance: { method: 'Review accepted project specification', sources: [{ locator: 'docs/spec/mcp-sqlite.md', label: 'Accepted specification' }] }, extensions: {},
      } },
      { kind: 'content.remove', section: 'fog', itemId: 'FollowOn' },
    ]),
    call('map_read', { mapId }),
    'Report the stable Map ID, retained revision 4, SourceReview Finding and newly unlocked Synthesis. Do not perform Synthesis.',
  ].join('\n'));
  assert.deepEqual(payloads(a).filter(item => item.kind === 'committed').map(item => typeof item.revision === 'number' ? item.revision : item.revision.revision), [1, 2, 3, 4]);
  assert.deepEqual(payloads(a).filter(item => item.kind === 'committed').at(-1).frontier, ['Synthesis']);

  const b = await codex('B-independent-resume', 'You are independent session B with claimant adoption:B. You know only the exact title '
    + JSON.stringify(title) + ', not its Map ID or session A transcript. First page through map_list and retain the unique returned stable ID. Default-read it. '
    + 'At the returned revision, claim Synthesis using {kind:"claim.acquire",ticketId:"Synthesis",claimantId:"adoption:B"}. '
    + 'Then settle it using the new returned revision and {kind:"ticket.settle",ticketId:"Synthesis",ticketType:"task",claimantId:"adoption:B",'
    + 'settlement:{outcome:{kind:"completion",statement:"Independent session resumed and completed synthesis",resultingFacts:{resumedByIndependentSession:true}},'
    + 'evidence:[],references:[],provenance:{method:"Independent installed-Codex adoption proof",sources:[]},extensions:{}}}. '
    + 'Default-read the final state. Never create a replacement Map or alter SourceReview.');
  assert.notEqual(a.threadId, b.threadId);
  assert.equal(b.calls[0].tool, 'map_list');
  assert(!b.calls.some(item => item.tool === 'map_create'));
  assert.deepEqual(payloads(b).filter(item => item.kind === 'committed').map(item => typeof item.revision === 'number' ? item.revision : item.revision.revision), [5, 6]);

  const beforeConflict = await known();
  assert.equal(beforeConflict.current.value.currentRevision, 6);
  const stale = await codex('A-conflict-reread', 'Your retained revision is 4. Make exactly one intentional stale request: '
    + call('map_apply', { mapId, expectedRevision: 4, commands: [{ kind: 'map.update', patch: { notes: 'Stale intention must not publish' } }] })
    + '\nA Conflict is expected. Then default-read the Map, observe current revision 6 and deliberately abandon the stale note intention. Do not retry, merge, take over or write again.', a.threadId);
  const conflicts = payloads(stale).filter(item => item.kind === 'conflict');
  assert.deepEqual(conflicts, [{ kind: 'conflict', conflict: { mapId, expectedRevision: 4, currentRevision: 6 } }]);
  assert.equal(stale.calls.filter(item => item.tool === 'map_apply').length, 1);
  assert.equal(payloads(stale).at(-1).revision.revision, 6);
  assert.deepEqual(await known(), beforeConflict);

  await stop();
  const unavailableEvidence = await unavailable();
  assert.deepEqual(await known(), beforeConflict);
  await start();
  const c = await codex('C-after-outage', 'The authority is available again. You know only the exact title '
    + JSON.stringify(title) + '. Use map_list to rediscover the stable ID, then default-read it. Confirm revision 6 and both Settlements. Perform no write.');
  assert(c.calls.every(item => ['map_list', 'map_read'].includes(item.tool)));
  assert.equal(payloads(c).at(-1).revision.revision, 6);
  assert.deepEqual(await known(), beforeConflict);

  const final = beforeConflict.current.value;
  assert.equal(final.fog.length, 0);
  assert.deepEqual(final.scopeExclusions.map(item => item.id), ['LegacyMigration']);
  assert.equal(final.tickets.find(ticket => ticket.id === 'SourceReview').settlement.outcome.kind, 'finding');
  assert.equal(final.tickets.find(ticket => ticket.id === 'Synthesis').settlement.outcome.kind, 'completion');
  assert.deepEqual(beforeConflict.catalog.maps.map(item => item.mapId), [mapId]);
  assert.equal(beforeConflict.next.kind, 'not_found');
  await stop();

  const sqlite = new DatabaseSync(':memory:');
  const sqliteVersion = sqlite.prepare('select sqlite_version() as version').get().version;
  sqlite.close();
  const protocols = readFileSync(protocolPath, 'utf8').trim().split('\n').map(line => JSON.parse(line).protocolVersion);
  const skill = readFileSync(join(repository, '.agents/skills/wayfinder/SKILL.md'));
  const report = {
    status: 'adopted workflow proof passed',
    serverCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
    installedClient: execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim(),
    node: process.version, sqliteVersion, sdk: '1.30.0', protocolVersions: [...new Set(protocols)],
    skillSha256: createHash('sha256').update(skill).digest('hex'), mapId, sessions, unavailableEvidence,
    assertions: [
      'new exploration catalog check/create/stable handle and atomic initial frontier',
      'Claim before work and typed research Settlement with provenance',
      'independent session catalog discovery/default read/distinct Claimant/atomic advance',
      'stale Conflict reread with deliberate abandonment and no replay/merge/takeover',
      'required service outage pauses with no fallback; later rediscovery retains exact state',
      'existing GitHub planning Maps are scope-excluded and not migrated or dual-written',
    ],
  };
  safe(report);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Installed-Codex Wayfinder adoption proof passed');
} finally {
  await stop();
  harness.cleanup();
}
