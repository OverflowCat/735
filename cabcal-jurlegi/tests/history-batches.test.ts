import test from 'node:test';
import assert from 'node:assert/strict';
import {
  historyWindows,
  loadHistoryBatches,
} from '../src/lib/services/history-batches';
import type { HistoryBatchProgress } from '../src/lib/services/history-batches';
import type { DeviceDataSource } from '../src/lib/services/data-source';

const end = 1_793_600_000_000;
test('all presets and custom windows cover every millisecond once, newest first', () => {
  for (const [range, duration] of [
    ['15m', 900000],
    ['1h', 3600000],
    ['24h', 86400000],
    ['7d', 604800000],
  ] as const) {
    const windows = historyWindows({ kind: 'relative', range }, end);
    assert.equal(windows[0].endMs, end);
    assert.equal(windows.at(-1)?.startMs, end - duration);
    assert.ok(windows[0].endMs - windows[0].startMs <= 900000);
    for (let i = 1; i < windows.length; i++)
      assert.equal(windows[i].endMs + 1, windows[i - 1].startMs);
    assert.ok(windows.every((w) => w.endMs - w.startMs <= 86400000));
  }
  assert.deepEqual(historyWindows({ kind: 'absolute', startMs: 0, endMs: 0 }), [
    { kind: 'absolute', startMs: 0, endMs: 0 },
  ]);
  assert.throws(() =>
    historyWindows({ kind: 'absolute', startMs: end, endMs: end - 1 }),
  );
});

test('each batch is published before the next request, sorted and deduplicated', async () => {
  const updates: HistoryBatchProgress[] = [];
  let requests = 0;
  const source: Pick<DeviceDataSource, 'getHistory'> = {
    async getHistory(id, metric, query, options) {
      assert.equal(id, 'gamma_12');
      assert.equal(metric, '0102060301');
      assert.ok(options?.signal);
      assert.equal(updates.length, requests++);
      assert.equal(query.kind, 'absolute');
      if (query.kind !== 'absolute') throw new Error();
      return [
        { timestamp: query.endMs, value: 1 },
        { timestamp: query.startMs, value: 2 },
        { timestamp: query.startMs, value: 3 },
        { timestamp: query.startMs - 1, value: 4 },
        { timestamp: query.startMs + 1, value: NaN },
      ];
    },
  };
  await loadHistoryBatches(
    source,
    'gamma_12',
    '0102060301',
    { kind: 'absolute', startMs: end - 86400000, endMs: end },
    new AbortController().signal,
    (b) => updates.push(b),
  );
  const last = updates.at(-1)!;
  assert.equal(last.completed, last.total);
  assert.equal(last.points.length, 2 * requests);
  assert.equal(last.points[0].timestamp, end - 86400000);
  assert.deepEqual(
    last.points.map((p) => p.timestamp),
    last.points.map((p) => p.timestamp).sort((a, b) => a - b),
  );
});

test('cancelled in-flight batches never publish stale data or request older windows', async () => {
  const controller = new AbortController();
  let calls = 0;
  let publications = 0;
  await assert.rejects(
    loadHistoryBatches(
      {
        async getHistory() {
          calls++;
          controller.abort();
          return [];
        },
      },
      'id',
      'metric',
      { kind: 'relative', range: '7d' },
      controller.signal,
      () => publications++,
    ),
    { name: 'AbortError' },
  );
  assert.equal(calls, 1);
  assert.equal(publications, 0);
});

test('later errors keep already published data and stop requesting more batches', async () => {
  let calls = 0;
  const updates: HistoryBatchProgress[] = [];
  await assert.rejects(
    loadHistoryBatches(
      {
        async getHistory(_id, _metric, q) {
          if (++calls > 1) throw new Error('network');
          if (q.kind !== 'absolute') throw new Error();
          return [{ timestamp: q.endMs, value: 42 }];
        },
      },
      'id',
      'metric',
      { kind: 'relative', range: '7d' },
      new AbortController().signal,
      (b) => updates.push(b),
    ),
    /network/,
  );
  assert.equal(calls, 2);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].points[0].value, 42);
});
