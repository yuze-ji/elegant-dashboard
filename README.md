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

The repository ships the built plugin, so no build step is required.

### Clone straight into your vault (easiest)

```bash
cd /path/to/your-vault/.obsidian/plugins
git clone https://github.com/yuze-ji/elegant-dashboard.git
```

Then enable **Elegant Dashboard** in *Settings → Community plugins*. If it is
not listed, click the reload icon next to *Installed plugins* first.

### Download the ZIP

1. **Code → Download ZIP** on the repository page.
2. Unzip it into `<vault>/.obsidian/plugins/`.
3. **Rename the folder** from `elegant-dashboard-main` to `elegant-dashboard`.
   GitHub appends the branch name, and Obsidian ignores folders whose name does
   not match the plugin id.
4. Enable it in *Settings → Community plugins*.

### Minimum files

If you prefer to copy files by hand, these four are enough:

| File | Purpose |
| --- | --- |
| `main.js` | The plugin itself |
| `manifest.json` | Plugin metadata |
| `styles.css` | Styling |
| `background.jpg` | Bundled Monet background (optional) |

Everything else in the repository is source and build tooling.

### From source

```bash
npm install
npm run build   # or `npm run dev` for a watch build
```

Requires Obsidian 1.6 or newer.

## Usage

Open the dashboard from the ribbon icon or the command palette.

| Command | What it does |
| --- | --- |
| `Open dashboard` | Reveals the dashboard tab, or creates one. |
| `Refresh dashboard` | Clears the word-count cache and redraws. |
| `Start / pause focus timer` | Controls the timer without opening the view. |

## Background image

Monet's *Water Lilies* (1906, Ryerson) ships with the plugin as
`background.jpg` and is enabled by default, so a fresh install looks like the
screenshots. The painting is in the public domain; the file comes from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg).

In *Settings → Appearance* you can:

- point **Background image** at any URL or vault-relative path,
- press **Monet** to return to the bundled painting,
- press **Clear** to turn the background off,
- adjust background opacity and card tint independently.

The bundled image is referenced by the sentinel `@bundled`, which resolves
against the plugin's actual install folder — renaming that folder will not
break it.

## License

MIT — see [LICENSE](LICENSE).
