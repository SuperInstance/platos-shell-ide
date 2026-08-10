/**
 * Tests for EventLogCore — the pure logic of the A2UI event logger.
 * No VS Code dependencies required.
 */

import { EventLogCore, A2UIEvent } from '../src/a2ui/event-log-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('EventLogCore', () => {
  let tmpDir: string;
  let logFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2ui-test-'));
    logFile = path.join(tmpDir, 'events.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('log()', () => {
    test('buffers events in memory', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'file_opened', timestamp: 1000, file: 'test.ts' });
      expect(core.bufferedCount).toBe(1);
    });

    test('updates counters by event type', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'file_opened', timestamp: 1000 });
      core.log({ type: 'file_opened', timestamp: 2000 });
      core.log({ type: 'file_saved', timestamp: 3000 });

      const counters = core.getCounters();
      expect(counters.file_opened).toBe(2);
      expect(counters.file_saved).toBe(1);
    });

    test('triggers flush at MAX_BATCH_SIZE', () => {
      const core = new EventLogCore(logFile);
      for (let i = 0; i < 500; i++) {
        core.log({ type: 'test_event', timestamp: i });
      }
      // After 500 events, flush should have occurred
      expect(core.bufferedCount).toBe(0);
      // File should exist
      expect(fs.existsSync(logFile)).toBe(true);
      // Count lines in file
      const content = fs.readFileSync(logFile, 'utf-8').trim();
      const lines = content.split('\n');
      expect(lines).toHaveLength(500);
    });

    test('handles arbitrary extra fields', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'selection_made', timestamp: 1000, file: 'a.ts', line: 42, text: 'hello' });
      expect(core.bufferedCount).toBe(1);
    });
  });

  describe('flush()', () => {
    test('writes buffered events to JSONL file', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'event_a', timestamp: 1000 });
      core.log({ type: 'event_b', timestamp: 2000 });
      core.flush();

      const content = fs.readFileSync(logFile, 'utf-8').trim();
      const lines = content.split('\n');
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]);
      expect(first.type).toBe('event_a');
      expect(first.timestamp).toBe(1000);

      const second = JSON.parse(lines[1]);
      expect(second.type).toBe('event_b');
    });

    test('appends to existing file', () => {
      fs.writeFileSync(logFile, '{"type":"existing","timestamp":0}\n');

      const core = new EventLogCore(logFile);
      core.log({ type: 'new_event', timestamp: 1000 });
      core.flush();

      const content = fs.readFileSync(logFile, 'utf-8').trim();
      const lines = content.split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).type).toBe('existing');
      expect(JSON.parse(lines[1]).type).toBe('new_event');
    });

    test('does nothing when buffer is empty', () => {
      const core = new EventLogCore(logFile);
      core.flush();
      expect(fs.existsSync(logFile)).toBe(false);
    });

    test('clears buffer after successful flush', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'test', timestamp: 1000 });
      core.flush();
      expect(core.bufferedCount).toBe(0);
    });

    test('re-queues events on write failure', () => {
      // Use an invalid path to trigger failure
      const badPath = '/nonexistent/dir/that/cannot/be/created/events.jsonl';
      const core = new EventLogCore(badPath);
      core.log({ type: 'test', timestamp: 1000 });
      core.flush();
      // Events should still be in buffer
      expect(core.bufferedCount).toBe(1);
    });
  });

  describe('getCounters()', () => {
    test('returns a copy, not a reference', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'test', timestamp: 1000 });
      const counters = core.getCounters();
      counters.test = 999;
      // Original should be unchanged
      expect(core.getCounters().test).toBe(1);
    });

    test('returns empty object for no events', () => {
      const core = new EventLogCore(logFile);
      expect(core.getCounters()).toEqual({});
    });
  });

  describe('getRecent()', () => {
    test('returns events of the specified type', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'a', timestamp: 1000 });
      core.log({ type: 'b', timestamp: 2000 });
      core.log({ type: 'a', timestamp: 3000 });

      const recent = core.getRecent('a');
      expect(recent).toHaveLength(2);
      expect(recent[0].timestamp).toBe(1000);
      expect(recent[1].timestamp).toBe(3000);
    });

    test('respects limit parameter', () => {
      const core = new EventLogCore(logFile);
      for (let i = 0; i < 20; i++) {
        core.log({ type: 'test', timestamp: i });
      }
      const recent = core.getRecent('test', 5);
      expect(recent).toHaveLength(5);
      // Should return the LAST 5 (most recent)
      expect(recent[0].timestamp).toBe(15);
      expect(recent[4].timestamp).toBe(19);
    });

    test('returns empty array for no matching events', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'a', timestamp: 1000 });
      expect(core.getRecent('b')).toEqual([]);
    });

    test('returns empty array when no events logged', () => {
      const core = new EventLogCore(logFile);
      expect(core.getRecent('anything')).toEqual([]);
    });
  });

  describe('totalEvents', () => {
    test('counts all events across types', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'a', timestamp: 1000 });
      core.log({ type: 'b', timestamp: 2000 });
      core.log({ type: 'a', timestamp: 3000 });
      expect(core.totalEvents).toBe(3);
    });

    test('returns 0 for no events', () => {
      const core = new EventLogCore(logFile);
      expect(core.totalEvents).toBe(0);
    });

    test('counts events even after flush', () => {
      const core = new EventLogCore(logFile);
      core.log({ type: 'a', timestamp: 1000 });
      core.flush();
      core.log({ type: 'b', timestamp: 2000 });
      expect(core.totalEvents).toBe(2);
    });
  });

  describe('integration: log then flush then log again', () => {
    test('multiple flush cycles work correctly', () => {
      const core = new EventLogCore(logFile);

      // First batch
      for (let i = 0; i < 10; i++) {
        core.log({ type: 'batch1', timestamp: i });
      }
      core.flush();

      // Second batch
      for (let i = 0; i < 10; i++) {
        core.log({ type: 'batch2', timestamp: i + 10 });
      }
      core.flush();

      // Verify file has all 20 events
      const content = fs.readFileSync(logFile, 'utf-8').trim();
      const lines = content.split('\n');
      expect(lines).toHaveLength(20);

      // Verify counters
      expect(core.totalEvents).toBe(20);
      expect(core.getCounters().batch1).toBe(10);
      expect(core.getCounters().batch2).toBe(10);
    });

    test('automatic flush at MAX_BATCH_SIZE preserves event order', () => {
      const core = new EventLogCore(logFile);

      // Log exactly MAX_BATCH_SIZE events
      for (let i = 0; i < 500; i++) {
        core.log({ type: 'auto_flush', timestamp: i, seq: i });
      }

      // Add more events after auto-flush
      for (let i = 0; i < 10; i++) {
        core.log({ type: 'post_flush', timestamp: 500 + i, seq: 500 + i });
      }
      core.flush();

      const content = fs.readFileSync(logFile, 'utf-8').trim();
      const lines = content.split('\n');
      expect(lines).toHaveLength(510);

      // First 500 should be auto_flush
      const first = JSON.parse(lines[0]);
      expect(first.type).toBe('auto_flush');
      expect(first.seq).toBe(0);

      // Last should be post_flush
      const last = JSON.parse(lines[509]);
      expect(last.type).toBe('post_flush');
      expect(last.seq).toBe(509);
    });
  });
});
