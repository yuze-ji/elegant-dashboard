# Elegant Dashboard

An Obsidian dashboard: note-activity heatmap, focus timer, project board, task
management, vault statistics and charts — in one view.

No Dataview dependency, no CDN. All charts are drawn on a canvas, so the plugin
works offline.

<!-- Add a screenshot here, e.g. ![Dashboard](docs/screenshot.png) -->

## Features

### Pages

The dashboard has four in-plugin pages — nothing opens a markdown tab.

| Page | Contents |
| --- | --- |
| **Overview** | Every module, read-only. A report, not an editor. |
| **Projects** | All projects including finished ones, fully editable. |
| **Tasks** | All tasks with no per-column cap, fully editable. |
| **Focus** | Timer plus the focus-time trend line. |

### Modules

- **Note activity heatmap** — week / month / year views. Hovering a day shows
  file activity, focus minutes and the notes created that day.
- **Focus timer** — countdown and count-up modes, canvas dial. Runs in the
  plugin, so it keeps going when the tab is closed, and banks every whole minute
  so a crash cannot lose a long session.
- **Projects board** — click the progress bar to set progress, click the status
  chip to cycle it, pencil to edit.
- **Taskboard** — completion rings against daily / weekly / monthly targets.
- **Task details** — today / todo / done columns with checkboxes, inline add and
  an edit modal (text, priority, pin, due date).
- **Recently edited** — ambiguous basenames are qualified with their folder.
- **Vault stats** — notes, words and links. The word counter is CJK-aware:
  Chinese characters are counted individually rather than as one "word" per
  paragraph.
- **Charts** — 12-month word trend and tag distribution, both with hover
  tooltips and highlight.
- **Focus history** — line chart with week / month / year ranges, plus totals,
  daily average, best day and current streak.
- **Plugin manager** — toggle any installed plugin.

### Appearance

- **Liquid glass** — backdrop blur with saturation boost, specular edge
  highlights and a diagonal sheen. Toggleable, with an adjustable blur radius.
- **Background image** — a URL or a vault-relative path. Local paths are
  resolved to `app://` resource URLs so they work offline.
- Separate opacity sliders for the background and the card tint.
- English and Chinese, switchable from the navbar.

## Data storage

Tasks and projects live in the plugin's `data.json`, not in markdown notes.
Every record carries a UUID, so edits and deletions are located by id rather
than by line number.

This is a deliberate trade-off:

- **Upside** — no note clutter, no stale line numbers, no risk of clobbering a
  concurrent editor edit.
- **Downside** — tasks are not visible to the Tasks plugin, Dataview, or global
  search, and uninstalling the plugin leaves the data as JSON.

Because the data lives under `.obsidian/`, make sure your sync or backup covers
`.obsidian/plugins/elegant-dashboard/data.json`.

## Install

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [releases](../../releases).
2. Put them in `<vault>/.obsidian/plugins/elegant-dashboard/`.
3. Enable the plugin in **Settings → Community plugins**.

### From source

```bash
git clone <this-repo> elegant-dashboard
cd elegant-dashboard
npm install
npm run build
```

Then copy the folder into `<vault>/.obsidian/plugins/`, or clone directly there.

For a watch build during development:

```bash
npm run dev
```

## Usage

Open the dashboard from the ribbon icon or the command palette.

| Command | What it does |
| --- | --- |
| `Open dashboard` | Reveals the dashboard tab, or creates one. |
| `Refresh dashboard` | Clears the word-count cache and redraws. |
| `Start / pause focus timer` | Controls the timer without opening the view. |

## Background image

The screenshots use Monet's *Water Lilies* (1906, Ryerson) from Wikimedia
Commons — public domain. It is not committed to this repository; fetch it with
the command in `.gitignore`, or point the setting at any image you like.

## License

MIT — see [LICENSE](LICENSE).
