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

## 2026-07-17 — ChatGPT Plus for normal development

Use ChatGPT Plus authentication for normal interactive Codex development
instead of API-key authentication. Keep API access only as a controlled
fallback for exceptional high-volume work or capabilities not covered by the
normal Plus workflow.

Reason: the initial five-day development period cost approximately $100 through
the API. Most processed input belonged to one long-lived, repeatedly cached
thread. Feature-scoped threads and repository-based handoffs provide better
cost control without changing SIMONE's engineering principles.

## 2026-07-26 — Separate EXPLORE and READ attention modes

SIMONE has two distinct interaction intentions that must not be combined into
one gesture model.

**EXPLORE** is continuous curtain discovery. Drag is its primary and most
important gesture, and projects remain secondary to the visitor's free
movement through the curtain. The secondary local “Moses” helper opens
temporarily around the clicked position in both directions. It belongs only to
EXPLORE, never navigates to or isolates a project, and returns to the captured
curtain state after offering a brief local view. Pointer movement beyond a
small tolerance remains the dominant drag gesture.

**READ** begins only when the visitor explicitly selects a project, primarily
through a future generous Index overlay. The Index may expose project name,
date, curtain position, and alternate sorting orders. Selection combines
navigation and reveal: the selected project should become flat and readable
while the curtain outside it remains naturally folded and unreadable. This
isolation must come from geometry, never blur, fading, darkening, or another
graphical focus effect. Moving to another project will likely refold the
previous selection before revealing the next.

Entering READ starts a fresh reading composition. SIMONE will not preserve or
restore the visitor's earlier EXPLORE curtain state. This reset is acceptable
only when its transition back to the neutral folded curtain is elegant,
meaningful, and clearly communicates that exploration is ending.

Reset is therefore not merely a technical restoration function. It is the
first expressive step in a deliberate reading sequence:

```text
Select Project
    ↓
Reset (curtain settles)
    ↓
Move to project
    ↓
Present Project
    ↓
Reading
```

READ presentation is defined by semantic project boundaries, from the
project's left gutter through its right edge. It must flatten that complete
span exactly; it must not be specified as an arbitrary number of columns. The
project is presented, not simply opened. Gentle folds on both sides should
eventually transition from the flat project into the normal dense, folded,
unreadable curtain.

The current NEXT/PREVIOUS controls and automatic partial reveal are temporary
READ-mode experiments. Preserve their useful navigation implementation, but do
not treat their reveal behavior as final product design or expand them before
the Index and READ flow are designed.

The resulting interaction feels closer to turning a page in a book than
navigating a website. Closing one work before presenting the next is an
intentional part of the experience rather than incidental animation.
