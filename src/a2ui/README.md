# A2UI — Agent-to-UI Learning System

> *The nervous system that learns.*

The A2UI (Agent-to-UI) subsystem is the observation and adaptation layer of Plato's Shell IDE. It records how the developer interacts with the IDE — which verbs they use, which rooms they visit, which files they open — and uses those patterns to adapt the UI over time.

## Files

| File | Lines | Role |
|------|-------|------|
| [`event-log-core.ts`](./event-log-core.ts) | 89 | Pure event logging logic: buffering, batching, flush to JSONL. Zero VS Code dependencies. |
| [`event-logger.ts`](./event-logger.ts) | 230 | VS Code integration: hooks file opens, saves, terminal events, cursor moves, command executions. Wraps EventLogCore. |

## Architecture

```
User Action → EventLogger (VS Code hooks)
                   ↓
             EventLogCore (pure logic)
                   ↓
             Event Log (JSONL file)
                   ↓
             [Phase 4: A2UI Model]
                   ↓
             [Phase 4: UI Adaptation]
```

## Phasing

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Raw Logging | ✅ Implemented | Record all user actions as JSONL events |
| 2 — Statistics | Planned | Most-used verbs, most-visited rooms, timing analysis |
| 3 — Prediction | Planned | Local model for predictive suggestions |
| 4 — Adaptation | Planned | Full adaptive UI (autocomplete, highlighting, pacing) |

## Event Types Logged

- `file_opened` — Editor activation
- `file_saved` — Document save
- `mud_command` — MUD terminal input
- `room_navigated` — Room change via inspector or MUD
- `verb_executed` — Verb invocation
- `cursor_moved` — Significant cursor position changes
- `terminal_opened` — Terminal creation

## Related

- [Plato's Shell IDE README](../../README.md)
- [Source README](../README.md)
- [Tests](../../tests/event-log-core.test.ts)
