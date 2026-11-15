# Nov 2026 redesign mockups

Interactive HTML mockups (open in a browser). Shared tokens live in `base.css`.

| File | What | Status |
|---|---|---|
| `trackers-web.html` | Trackers list + detail (pace, chart, check-ins) | Building now |
| `trackers-checkin-and-create.html` | Mobile "Today" check-in + "New tracker" form | Building now |
| `tasks-board-and-panel.html` | Flat task cards + docked task panel | Revisit design before building |
| `task-create-edit.html` | Task create/edit page, single-select assignee | Revisit design before building |

Design rules used: no cards inside cards (hairline dividers + spacing instead), monochrome zinc with colour only for status,
critically damped springs (Apple *Designing Fluid Interfaces*), press feedback on pointer-down, Animate UI patterns
(sliding highlight, sliding/counting numbers) on top of `motion/react`, reduced-motion fallback.
