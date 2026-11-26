# OpenTrak

An open-source construction scheduler built around the Critical Path Method, with the familiar SureTrak / Primavera look and a modern, easier interface.

OpenTrak is a single HTML file. Open `dist/opentrak.html` in any modern browser (Chrome, Edge, Firefox, Safari). There is nothing to install, no server, and no account. The app makes no network requests, so your schedules stay on your machine.

## Features

**Scheduling engine (CPM)**
- Forward and backward pass with total float, free float and the critical path
- All four relationship types (FS, SS, FF, SF), with lags and leads in work days
- Multiple calendars with work weeks and holidays. Recurring holidays (New Year's, MLK, Presidents', Good Friday, Memorial, July 4th, Labor, Columbus, Election Day, Veterans, Thanksgiving and the day after, Christmas, plus optional Juneteenth, Lincoln's Birthday, Christmas Eve and New Year's Eve) are worked out for every year automatically, with weekend holidays moved to Friday or Monday; one-off non-work days can be added too
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
- **Why these dates:** the detail panel traces the driving path back to where it starts, says how far the activity is behind the baseline, and names the activities that caused the delay (e.g. "duration grew from 45 to 50 days, +10d"). In the Claude-hosted version, **Suggest ways to recover** hands that path to the assistant
- **Update progress:** pick a new data date and see only the work that should have started by then. Mark each one Not started / Started / Done, or click **Fill in as planned** and adjust what went differently. A live preview shows how the finish date moves before you apply, and the whole update undoes in one step
- **Type links in the table:** the Predecessors and Successors columns are editable, SureTrak style: `A1020, A1030 SS+3, A1040 FF-2`. Unknown IDs and loops are rejected with a clear message
- **Go to anything (Ctrl+K):** type any command ("calendar", "baseline", "update") or an activity ID or name and press Enter
- Schedule check for logic loops, open ends, negative float, out-of-sequence progress and bad actual dates
- Baseline (target) with a variance column and a finish variance in the toolbar
- Filters (critical, incomplete, issues), search, Day/Week/Month zoom, undo and redo
- Deletes and bar drags happen immediately with an **Undo** button in the confirmation message, instead of "are you sure?" dialogs
- Dragging a bar's edge shows the new duration and finish date as you drag
- The autosave status under the project name only says "Autosaved" when the save actually worked, and warns if the browser blocks storage

**Formatting** (saved with the project)
- Format Bars: color, thickness and position for each bar type; milestone shapes; bar labels; row height and text size
- Presets for "SureTrak classic", "Color-blind safe" (Okabe-Ito palette) and "Modern"
- 24 available columns: choose, reorder, and drag header edges to resize

**Spell check** (works offline)
- Possible misspellings in activity names and resources are underlined in the table automatically; a Spelling tool lists every one with suggested fixes
- Fix a word everywhere at once, ignore it, or add it to the project dictionary (saved in the project file and shared with anyone who opens it)
- Construction and elevator terms (hoistway, sheave, submittal, closeout, DOB, RFI…) are built in; edit `src/words.txt` to add more
- Text boxes also get the browser's own as-you-type spell checking

**Schedule assistant** (in the Claude-hosted version)
- Ask questions about the schedule ("why are we late?") or describe changes in plain English
- The assistant proposes exact edits (add activities, links, durations, progress, constraints, data date); nothing changes until you click Apply, and applied changes undo as one step
- Every proposed edit is validated like a manual edit; changes that would create a logic loop are rejected
- Hidden in standalone copies: running it outside Claude needs an AI API key, which must live on a server, not in this file (planned with the server version)

**Output**
- **Print preview** (Ctrl+P): the real pages, drawn by the same code as the PDF, update as you change the options. Zoom to the whole page, fit width or 100%
  - Page: Letter, Legal, Tabloid (11×17), A4 or A3; landscape or portrait; compact, normal or roomy rows
  - Activities: all, as shown on screen, critical only, or not yet complete; with or without WBS group rows
  - Chart: logic lines, baseline, progress and float bars, non-work day shading, data date line, legend and title block, and the label beside each bar
  - Columns for printing, separate from the screen (or the same as the screen by default), and an optional timescale range
  - Title, company / prepared by, and a revision note such as "Rev 2 — overtime option" printed in the page header
  - Saves a vector PDF (sharp at any size) or sends it to the printer. Settings are remembered with the project
- CSV export for Excel, protected against spreadsheet formula injection
- Project files are saved as `.json`, and work also autosaves in the browser

## Keyboard shortcuts

| Key | Action |
|---|---|
| Insert or Ctrl+Enter | Add an activity after the selected one, linked to it |
| ↑ / ↓ | Move the selection |
| F2 | Rename the selected activity |
| Delete | Delete the selected activity (Undo in the message brings it back) |
| Ctrl+K | Go to anything: any command or activity |
| / | Jump to the activity filter (Esc clears it) |
| ? | Show all keyboard shortcuts |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save the project file |
| Ctrl+P | Print preview / PDF |
| Esc | Close the panel or dialog |

## Run it on the web (GitHub Pages)

`docs/index.html` is the built app. To host it free on GitHub Pages: open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose **main** and **/docs**, then click **Save**. It will be live at `https://stevelindgren.github.io/OpenTrak/` within a minute or two. Each person's schedules stay in their own browser; the site stores nothing.

## Development

```bash
npm install      # jsPDF, IBM Plex Sans, nspell + dictionary, esbuild (build only)
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
- **Pinned dependencies, bundled at build time:** jsPDF 2.5.2 (MIT), IBM Plex Sans (SIL OFL 1.1), nspell 2.1.5 (MIT) and the en_US Hunspell dictionary from SCOWL (MIT and BSD).

## Roadmap

- Import from SureTrak/P3 (via MPX or MPXJ) and Primavera P6 (XER/XML)
- Windows desktop app (.exe) with direct printing
- Multi-level WBS, resource histograms and cost curves
- Optional multi-user server with sign-in, roles and an audit trail

## License

MIT. See [LICENSE](LICENSE).
