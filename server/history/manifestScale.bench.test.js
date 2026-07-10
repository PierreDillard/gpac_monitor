import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { HistoryWriter } from './HistoryWriter.js';
import {
  parseManifest,
  findEventChunkIndex,
  findNearestCheckpoint,
} from '../../src/services/historyService/manifestParser';

const SECOND_US = 1_000_000;
const HOUR_US = 3600 * SECOND_US;
const CHUNK_DURATION_US = 10 * SECOND_US;
const SAMPLE_COUNT = 15;
const LOOKUP_POINTS = 20;

// Rates derived from the real recorded session server/history/1783507528983/manifest.json
// (161.5s window: 195 logs/s, 19 eventsIndex entries incl. 2 graph-change, 6 journal facts).
// `writeLog` is called once/s (not 195x/s) because the manifest's logChunks entries carry a
// `count` field — the array LENGTH (driving manifest size) only depends on chunk boundaries
// (10s, duration-gated), not on how many literal write() calls produced it.
const REALISTIC_PROFILE = { name: 'realistic', reconfigPerSecond: 0.117, graphChangePerSecond: 0.0124, journalFactPerSecond: 0.037 };
const CHURN_PROFILE = { name: 'churn-worst-case', reconfigPerSecond: 1, graphChangePerSecond: 0.1, journalFactPerSecond: 0.037 };

function buildManifestSnapshot(writer) {
  return {
    version: 1,
    startUs: writer._sessionStartUs,
    endUs: writer._lastEventUs,
    chunkDurationUs: CHUNK_DURATION_US,
    chunkCount: writer._events.getChunkCount(),
    snapshot: 'snapshot.json',
    checkpoints: writer._checkpoints,
    logChunks: writer._logs.getAllChunks(),
    eventsIndex: [...writer._eventsIndex].sort((a, b) => a.ts_us - b.ts_us),
    journalIndex: writer._getJournalPointer(),
  };
}

function runSimulation(durationUs, profile) {
  const writer = new HistoryWriter('bench-history', `bench-${profile.name}-${durationUs}`);
  // _writeManifest() re-stringifies the whole growing state on every rotation (O(n) per call) —
  // at full production frequency, collapsing hours into ms turns that into a test that never
  // finishes. Neutralize it; state accumulation stays real, we sample the rewrite cost ourselves.
  writer._writeManifest = () => {};
  const stringifySamples = [];
  const totalChunks = Math.ceil(durationUs / CHUNK_DURATION_US);
  const sampleEveryNChunks = Math.max(1, Math.floor(totalChunks / SAMPLE_COUNT));
  let pendingCheckpoint = false;
  let lastSampledChunk = -1;

  for (let tsUs = SECOND_US; tsUs <= durationUs; tsUs += SECOND_US) {
    const rotated = writer.writeEvent(JSON.stringify({ message: 'session_stats', ts_us: tsUs }), tsUs);
    writer.writeLog(JSON.stringify({ message: 'log_batch', ts_us: tsUs }), tsUs);

    if (Math.random() < profile.reconfigPerSecond) writer.addEventIndex(tsUs, 'pid-reconfig');
    if (Math.random() < profile.graphChangePerSecond) {
      writer.addEventIndex(tsUs, 'graph-change');
      pendingCheckpoint = true;
    }
    if (Math.random() < profile.journalFactPerSecond) writer.recordJournalFact(tsUs, 1);

    if (rotated) {
      const chunkIndex = writer.getCurrentChunkIndex();
      if (pendingCheckpoint && chunkIndex > 0) {
        writer.writeCheckpoint(chunkIndex, { version: 1, ts_us: tsUs, graph_v: 1, filters: [], pid_state: null });
        pendingCheckpoint = false;
      }
      if (chunkIndex - lastSampledChunk >= sampleEveryNChunks) {
        lastSampledChunk = chunkIndex;
        const manifest = buildManifestSnapshot(writer);
        const start = performance.now();
        const json = JSON.stringify(manifest);
        stringifySamples.push({ chunkIndex, bytes: json.length, stringifyMs: performance.now() - start });
      }
    }
  }

  return { writer, stringifySamples, finalManifest: buildManifestSnapshot(writer) };
}

// `parseMs` covers both JSON.parse and parseManifest() validation — together, the client cost
// of turning the wire payload into a usable manifest.
function measureClientCost(finalManifest) {
  const rawJson = JSON.stringify(finalManifest);
  const parseStart = performance.now();
  const manifest = parseManifest(JSON.parse(rawJson));
  const parseMs = performance.now() - parseStart;

  const points = Array.from({ length: LOOKUP_POINTS }, (_, index) =>
    manifest.startUs + Math.floor((index / (LOOKUP_POINTS - 1)) * (manifest.endUs - manifest.startUs)),
  );
  const lookupStart = performance.now();
  for (const tsUs of points) {
    findEventChunkIndex(manifest, tsUs);
    findNearestCheckpoint(manifest, findEventChunkIndex(manifest, tsUs));
  }
  const avgLookupMs = (performance.now() - lookupStart) / points.length;

  return { manifest, rawBytes: rawJson.length, parseMs, avgLookupMs };
}

describe('manifest scale benchmark (history-main long sessions)', () => {
  const durations = [
    { label: '1h', us: 1 * HOUR_US },
    { label: '6h', us: 6 * HOUR_US },
    { label: '24h', us: 24 * HOUR_US },
  ];
  const profiles = [REALISTIC_PROFILE, CHURN_PROFILE];
  const rows = [];

  for (const profile of profiles) {
    for (const duration of durations) {
      it(`${profile.name} / ${duration.label}`, () => {
        const { stringifySamples, finalManifest } = runSimulation(duration.us, profile);
        const client = measureClientCost(finalManifest);
        const first = stringifySamples[0];
        const last = stringifySamples[stringifySamples.length - 1];

        rows.push({
          profile: profile.name,
          duration: duration.label,
          chunkCount: finalManifest.chunkCount,
          eventsIndexCount: finalManifest.eventsIndex.length,
          checkpointsCount: finalManifest.checkpoints.length,
          logChunksCount: finalManifest.logChunks.length,
          manifestBytes: client.rawBytes,
          stringifyMsFirst: first?.stringifyMs.toFixed(3),
          stringifyMsLast: last?.stringifyMs.toFixed(3),
          parseMs: client.parseMs.toFixed(3),
          avgLookupMs: client.avgLookupMs.toFixed(4),
        });

        expect(finalManifest.chunkCount).toBeGreaterThan(0);
      });
    }
  }

  it('reports results and writes tasks/history-main/manifest-scale-report.md', () => {
    // runs last within this describe block (vitest preserves declaration order)
    console.table(rows);
    const header = '| profile | duration | chunkCount | eventsIndex | checkpoints | logChunks | manifestBytes | stringifyMs(first→last) | parseMs | avgLookupMs |\n' +
      '|---|---|---|---|---|---|---|---|---|---|\n';
    const body = rows
      .map((row) => `| ${row.profile} | ${row.duration} | ${row.chunkCount} | ${row.eventsIndexCount} | ${row.checkpointsCount} | ${row.logChunksCount} | ${row.manifestBytes} | ${row.stringifyMsFirst} → ${row.stringifyMsLast} | ${row.parseMs} | ${row.avgLookupMs} |`)
      .join('\n');
    fs.writeFileSync('tasks/history-main/manifest-scale-report.md', `# Manifest scale benchmark\n\n${header}${body}\n`);
    expect(rows.length).toBe(profiles.length * durations.length);
  });
});
