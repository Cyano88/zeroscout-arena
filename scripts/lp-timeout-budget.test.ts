import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as flush } from 'node:timers/promises';
import { LpComputeBudget } from '../server/src/services/lp-compute-budget.js';

process.env.ZG_COMPUTE_API_KEY = 'test-only';
process.env.ZG_COMPUTE_BASE_URL = 'https://router.example.test/v1';
process.env.ZEROSCOUT_LP_MODEL = 'claude-fable-5';
process.env.ZEROSCOUT_LP_VERIFIER_MODEL = 'claude-sonnet-5';
process.env.ZEROSCOUT_LP_VERIFIER_ENABLED = 'true';
const { generateCustomIntelligence } = await import('../server/src/services/ai.js');
const lp = { partner: 'PolyDesk', productType: 'prediction-market', analysisType: 'lp-market-intelligence', objective: 'Review saved evidence', outputStyle: 'brief', data: { scout: { opportunities: [] } } };

 test('attempt timeout aborts transport even when operation never resolves', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const budget = new LpComputeBudget(90_000, 30_000);
  let signal: AbortSignal | undefined;
  const request = budget.run(s => { signal = s; return new Promise(() => {}); });
  const checked = assert.rejects(request, /timed out after 30000ms/);
  t.mock.timers.tick(30_000);
  await checked;
  assert.equal(signal?.aborted, true);
 });

 test('verifier shares remaining budget and expired budget launches nothing', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const budget = new LpComputeBudget(90_000, 30_000);
  await budget.run(async () => 'primary');
  t.mock.timers.tick(80_000);
  const checked = assert.rejects(budget.run(() => new Promise(() => {})), /timed out after 10000ms/);
  t.mock.timers.tick(10_000);
  await checked;
  let launched = false;
  await assert.rejects(budget.run(async () => { launched = true; }), /budget exhausted/);
  assert.equal(launched, false);
 });

 test('LP generation stops fallback requests at the shared 90-second deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const signals: AbortSignal[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const signal = init.signal!;
    signals.push(signal);
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  });
  const checked = assert.rejects(generateCustomIntelligence(lp), /could not finalize/);
  for (let i = 0; i < 3; i++) {
    await flush();
    assert.equal(signals.length, i + 1);
    t.mock.timers.tick(30_000);
  }
  await checked;
  await flush();
  assert.equal(signals.length, 3, 'No fourth model or verifier after deadline');
  assert(signals.every(signal => signal.aborted));
 });

 test('LP verifier transport is bounded after primary succeeds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let requests = 0;
  let verifierSignal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    if (++requests === 1) return new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify({summary:'No candidate passed.'})}]}), {status:200});
    verifierSignal = init.signal!;
    return new Promise<Response>((_resolve, reject) => {
      verifierSignal!.addEventListener('abort', () => reject(new Error('aborted')), {once:true});
    });
  });
  const checked = assert.rejects(generateCustomIntelligence(lp), /timed out/);
  await flush();
  assert.equal(requests, 2);
  t.mock.timers.tick(30_000);
  await checked;
  assert.equal(verifierSignal?.aborted, true);
  assert.equal(requests, 2);
 });
