# OpenTrak — guidance for every change

**Powerful underneath. Simple on the surface.** Complexity belongs in the scheduling engine, not in the user interface.

The goal is not the most feature-rich construction scheduler. It is the most intuitive, efficient and intelligent one.

## Before building anything

Evaluate the existing experience first and look for a simpler, faster or more intuitive approach. Ask:

- Can this be done in fewer clicks, or can steps be removed?
- Can repetitive work be automated, or can a smart default replace manual input?
- Can the app anticipate what the user needs next?
- Can a scheduling concept be explained in plainer language?
- Can existing functionality be consolidated instead of adding more?
- Can information be shown more clearly, with less cognitive load?
- Can AI simplify the workflow rather than add complexity?

Do not implement a request literally if a better experience is possible: propose the better option, its benefits and tradeoffs. Low-risk usability improvements can go straight in. **Get the owner's approval before significantly changing an established workflow or redesigning a major interface component.**

Do not add a feature just because competing software has it. Every feature must solve a real user problem.

## Design requirements

- Clarity, consistency and simplicity first. Progressive disclosure: advanced options stay reachable without crowding beginners.
- Avoid unnecessary menus, buttons, panels, dialogs and settings screens. Prefer contextual actions to menu trips.
- Prefer undo over "are you sure?" dialogs for anything undo can reverse.
- Use familiar desktop patterns (SureTrak/Primavera, Excel, Office) and keyboard shortcuts; keep mouse and keyboard paths efficient.
- Consistent typography, spacing, icons and hierarchy (reuse the existing CSS variables and `.btn` / `.pill` / `.seg` styles).
- Every action gives visible feedback. Error messages say what went wrong and what to do next.
- WCAG 2.2 AA: contrast in both themes, labeled controls, visible focus, no information carried by color or tooltip alone.
- Design for people with little scheduling or technical experience, without slowing down professional schedulers.

## AI

AI should feel like part of the app, not a separate chatbot: reduce repetitive work, explain scheduling problems, flag risks, resolve conflicts and recommend fixes. Users stay in control: previews, explicit approval, and one-step undo.

## Judge every change by

Time to complete the task · number of interactions · ease of learning · error prevention · visual clarity · accessibility · user confidence · scheduling accuracy · overall productivity.

## Design system

The visual rules live in the OpenTrak design system (https://claude.ai/artifact/1xezTxVZBu8Ld4E67crD4u): brand book, tokens for both themes, and component guidelines. In code, every token is a CSS custom property prefixed `--ot-` defined once at the top of `src/app.html` (`surface` → `--ot-surface`). Older variable names (`--panel`, `--line`, `--muted`…) are aliases of those tokens.

- Use tokens, never raw hex, in new UI. Chrome stays graphite; color only for meaning (critical, warning, success) and cobalt only for focus, selection, the primary action and the data date.
- One filled primary button per view. Everything else is an outlined or ghost button, a menu item or a link.
- Status is text in the status line, not pills. Secondary options go in a menu (`.menu-wrap` + `menuToggle`), one level deep.
- Four type sizes (16 / 13 / 12 / 11), three weights (400 / 500 / 600), tabular figures, sentence case.
- Hairlines (`border`, `border-subtle`) separate regions; shadows only on menus and dialogs.
- Check both themes and phone width (390px) for every change; keep axe-core WCAG 2.2 AA clean, including 24px click targets.

## Repo conventions

- `src/engine.js` is the pure CPM engine (no DOM). Add engine tests to `test/engine.test.js` for any scheduling change; `npm test` must pass.
- `src/app.html` is the whole interface. All state changes go through `commit()` so they autosave and undo. Escape all user text with `esc()`; sanitize anything loaded from a file in `sanitize()`.
- `npm run build` regenerates `dist/opentrak.html` and `docs/index.html` (GitHub Pages). Commit the rebuilt files with the source change.
- No network access from the app (CSP `connect-src 'none'`); bundle any dependency at build time.
- Update the README's feature list and keyboard shortcut table when behaviour changes.
- Work on a branch and open a pull request; don't push straight to `main`.
