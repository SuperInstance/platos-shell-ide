# Plato's Shell IDE — Tests

> *Testing the shell before the crab moves in.*

## Structure

```
tests/
├── __mocks__/
│   └── vscode.ts              — Minimal VS Code API mock
├── event-log-core.test.ts     — Pure logic tests for A2UI EventLogCore
```

## Test Suite

| File | What It Covers |
|------|---------------|
| [`event-log-core.test.ts`](./event-log-core.test.ts) | Event buffering, batching, flush triggers, counter tracking, JSONL format, file persistence, batch size limits |
| [`__mocks__/vscode.ts`](./__mocks__/vscode.ts) | Minimal VS Code namespace mock: `window`, `workspace`, `commands`, `Disposable` |

```bash
npm test
```

**Stack:** Jest + ts-jest

## Design Decision: Testable Core

The A2UI event logger was split into two files specifically for testability:

- `event-log-core.ts` — Pure TypeScript, no `vscode` import. Tested directly.
- `event-logger.ts` — VS Code integration layer. Requires extension host or mock.

This separation means the core event logic (buffering, batching, flushing, counting) is fully tested without needing a running VS Code instance. The VS Code hooks are thin wrappers.

## Related

- [Plato's Shell IDE README](../README.md)
- [A2UI README](../src/a2ui/README.md)
- [Source](../src/)
