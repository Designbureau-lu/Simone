# SIMONE Decision Log

This file records durable project and engineering-workflow decisions.

## 2026-07-17 — Feature-scoped Codex threads

Use one Codex thread for each coherent feature or investigation. Keep threads
short and do not carry week-long conversations across unrelated work.

Begin every new thread by reading `AGENTS.md`, `CURRENT_STATE.md`, and the
relevant parts of `ARCHITECTURE.md`. Record material implementation progress
and unresolved investigations in `CURRENT_STATE.md` so a new thread can resume
without relying on conversation history.

Reason: long-running threads repeatedly process large accumulated contexts and
make project state harder to hand off. Repository documentation is the durable
source of project memory.
