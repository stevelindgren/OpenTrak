# OpenTrak

An open-source construction scheduler built around the Critical Path Method, with the familiar SureTrak / Primavera look and a modern, easier interface.

OpenTrak is a single HTML file. Open `dist/opentrak.html` in any modern browser (Chrome, Edge, Firefox, Safari). There is nothing to install, no server, and no account. The app makes no network requests, so your schedules stay on your machine.

## Features

**Scheduling engine (CPM)**
- Forward and backward pass with total float, free float and the critical path
- All four relationship types (FS, SS, FF, SF), with lags and leads in work days
- Multiple calendars with work weeks and holidays (US construction holidays for 2026–27 included)
- Constraints: start on or after/before, finish on or after/before, must start on, must finish on, and a project "must finish by" date
- Progress: data date, actual start and finish, % complete, remaining duration, with retained logic
- Automatic recalculation on every edit (no F9)

**Interface**
- Dark theme by default with a light theme toggle; IBM Plex Sans embedded so it works offline
- Accessibility: WCAG 2.2 AA contrast in both themes (checked with axe-core), labeled controls, keyboard focus kept in dialogs, and a color-blind-safe bar preset
- Activity table grouped by WBS, with inline editing (click a cell, then Enter or Tab)
- Gantt chart with critical path, progress, float, baselines and logic lines
- Drag from a bar's end to another bar to link them, or drag a bar's edge to change its duration
- Detail panel for dates, progress, constraints, predecessors and successors (with driving links marked) and notes
- Schedule check for logic loops, open ends, negative float, out-of-sequence progress and bad actual dates
- Baseline (target) with a variance column and a finish variance in the toolbar
- Filters (critical, incomplete, issues), search, Day/Week/Month zoom, undo and redo

**Formatting** (saved with the project)
- Format Bars: color, thickness and position for each bar type; milestone shapes; bar labels; row height and text size
- Presets for "SureTrak classic", "Color-blind safe" (Okabe-Ito palette) and "Modern"
- 24 available columns: choose, reorder, and drag header edges to resize

**Schedule assistant** (in the Claude-hosted version)
- Ask questions about the schedule ("why are we late?") or describe changes in plain English
- The assistant proposes exact edits (add activities, links, durations, progress, constraints, data date); nothing changes until you click Apply, and applied changes undo as one step
- Every proposed edit is validated like a manual edit; changes that would create a logic loop are rejected
- Hidden in standalone copies: running it outside Claude needs an AI API key, which must live on a server, not in this file (planned with the server version)

**Output**
- Print / PDF in Letter, Legal, Tabloid (11×17), A4 or A3, landscape or portrait, with a title block, legend and multi-page output. The PDF is vector, so it stays sharp at any size.
- CSV export for Excel, protected against spreadsheet formula injection
- Project files are saved as `.json`, and work also autosaves in the browser

## Keyboard shortcuts

| Key | Action |
|---|---|
| Insert or Ctrl+Enter | Add an activity after the selected one |
| ↑ / ↓ | Move the selection |
| F2 | Rename the selected activity |
| Delete | Delete the selected activity (asks first) |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save the project file |
| Ctrl+P | Print / PDF |
| Esc | Close the panel or dialog |

## Run it on the web (GitHub Pages)

`docs/index.html` is the built app. To host it free on GitHub Pages: open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose **main** and **/docs**, then click **Save**. It will be live at `https://stevelindgren.github.io/OpenTrak/` within a minute or two. Each person's schedules stay in their own browser; the site stores nothing.

## Development

```bash
npm install      # pulls jsPDF, the only dependency
npm test         # CPM engine unit tests
npm run build    # writes dist/opentrak.html
```

| Path | What it is |
|---|---|
| `src/engine.js` | Scheduling engine: pure functions, no DOM, also runs under Node |
| `src/app.html` | Interface (HTML, CSS and JS). `/*ENGINE*/` and `/*JSPDF*/` are filled in at build time. |
| `test/engine.test.js` | Engine tests: logic types, lags, calendars, constraints, progress, loops, performance |
| `dist/opentrak.html` | Built single-file app |

## Security

- **No network access.** The built app ships a Content-Security-Policy with `connect-src 'none'`, and it loads no external scripts, fonts or images.
- **Opened files are untrusted.** Every project file is rebuilt field by field through a sanitizer: types are checked, lengths and counts are capped, and dates are validated. Unknown fields are dropped.
- **No unescaped HTML.** All user text is escaped before it reaches the page; nothing is evaluated.
- **CSV export** neutralizes cells that start with `= + - @` so Excel won't run them as formulas.
- **Pinned dependencies, bundled at build time:** jsPDF 2.5.2 (MIT) and IBM Plex Sans (SIL OFL 1.1).

## Roadmap

- Import from SureTrak/P3 (via MPX or MPXJ) and Primavera P6 (XER/XML)
- Windows desktop app (.exe) with direct printing
- Multi-level WBS, resource histograms and cost curves
- Optional multi-user server with sign-in, roles and an audit trail

## License

MIT. See [LICENSE](LICENSE).
