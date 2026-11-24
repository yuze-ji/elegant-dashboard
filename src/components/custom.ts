import { Notice, TFile, setIcon } from "obsidian";
import { CustomItem, CustomPanel } from "../types";
import { Ctx, card, empty } from "../ui";
import { linkMark, openLink, setIconOr } from "./home";

/**
 * User-defined panels: a title and a list of items, each of a kind —
 *   link     → opens a URL (https://, obsidian://, mailto:)
 *   note     → opens a note in the vault
 *   folder   → a count tile: markdown notes under that folder; click = search
 *   tag      → a count tile: notes carrying that tag; click = search
 *   command  → runs an Obsidian command by id (e.g. "daily-notes")
 * Nothing here is baked in: the panels, their order and every item come
 * from Settings → Custom panels. The "Information / Area / GTD / Resource"
 * boards of a typical start page are all expressible as these.
 */

function countFolder(ctx: Ctx, folder: string): number {
  const prefix = folder.replace(/^\/+|\/+$/g, "");
  if (!prefix) return ctx.app.vault.getMarkdownFiles().length;
  return ctx.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix + "/")).length;
}

function countTag(ctx: Ctx, tag: string): number {
  const wanted = (tag.startsWith("#") ? tag : `#${tag}`).toLowerCase();
  let n = 0;
  for (const f of ctx.app.vault.getMarkdownFiles()) {
    const cache = ctx.app.metadataCache.getFileCache(f);
    if (!cache) continue;
    const tags = new Set<string>();
    for (const t of cache.tags ?? []) tags.add(t.tag.toLowerCase());
    const fm = cache.frontmatter?.tags as unknown;
    const fmList = Array.isArray(fm) ? fm : typeof fm === "string" ? fm.split(/[,\s]+/) : [];
    for (const t of fmList) if (typeof t === "string" && t) tags.add((t.startsWith("#") ? t : `#${t}`).toLowerCase());
    if ([...tags].some((t) => t === wanted || t.startsWith(wanted + "/"))) n++;
  }
  return n;
}

function openSearch(ctx: Ctx, query: string) {
  const search = (ctx.app as unknown as {
    internalPlugins?: { getPluginById?: (id: string) => { instance?: { openGlobalSearch?: (q: string) => void } } | null };
  }).internalPlugins?.getPluginById?.("global-search")?.instance;
  if (search?.openGlobalSearch) search.openGlobalSearch(query);
  else new Notice(query);
}

function runCommand(ctx: Ctx, id: string) {
  const commands = (ctx.app as unknown as {
    commands?: { executeCommandById?: (id: string) => boolean; commands?: Record<string, unknown> };
  }).commands;
  if (!commands?.executeCommandById?.(id.trim())) new Notice(`⚠️ ${id}`);
}

function activate(ctx: Ctx, item: CustomItem) {
  const target = item.target.trim();
  switch (item.kind) {
    case "link":
      openLink(ctx, target);
      return;
    case "note": {
      const f = ctx.app.vault.getAbstractFileByPath(target.endsWith(".md") ? target : `${target}.md`);
      if (f instanceof TFile) void ctx.app.workspace.openLinkText(f.path, "", "tab");
      else void ctx.app.workspace.openLinkText(target, "", "tab");
      return;
    }
    case "folder":
      openSearch(ctx, `path:"${target.replace(/^\/+|\/+$/g, "")}"`);
      return;
    case "tag":
      openSearch(ctx, `tag:${target.startsWith("#") ? target : "#" + target}`);
      return;
    case "command":
      runCommand(ctx, target);
      return;
  }
}

/** The mark on a button/tile: the item's own icon (emoji or Lucide name), else one by kind/host. */
function mark(parent: HTMLElement, item: CustomItem) {
  const el = parent.createSpan({ cls: "ed-custom-mark" });
  const own = item.icon.trim();
  if (own) {
    if (/^\p{Extended_Pictographic}/u.test(own)) el.setText(own);
    else setIconOr(el, own);
    return;
  }
  const byKind: Record<CustomItem["kind"], string> = {
    link: "globe",
    note: "file-text",
    folder: "folder",
    tag: "tag",
    command: "terminal",
  };
  if (item.kind === "link") {
    const m = linkMark(item.target);
    if (m.emoji) el.setText(m.emoji);
    else setIconOr(el, m.icon ?? "globe");
  } else {
    setIconOr(el, byKind[item.kind]);
  }
}

export function renderCustomPanels(parent: HTMLElement, ctx: Ctx) {
  const { t, settings } = ctx;
  if (settings.customPanels.length === 0) {
    const root = card(parent, `🧩 ${t.customPanels}`);
    empty(root, t.customPanelsEmpty);
    return;
  }
  for (const panel of settings.customPanels) renderPanel(parent, ctx, panel);
}

function renderPanel(parent: HTMLElement, ctx: Ctx, panel: CustomPanel) {
  const { t } = ctx;
  const root = card(parent, panel.title.trim() || t.customPanels);
  root.addClass("ed-custom");
  if (panel.items.length === 0) {
    empty(root, t.customPanelNoItems);
    return;
  }
  const grid = root.createDiv({ cls: "ed-custom-grid" });
  for (const item of panel.items) {
    const isCount = item.kind === "folder" || item.kind === "tag";
    const el = grid.createEl("button", { cls: isCount ? "ed-custom-tile" : "ed-custom-btn" });
    el.setAttr("title", item.target);
    if (isCount) {
      const head = el.createDiv({ cls: "ed-custom-tile-head" });
      mark(head, item);
      head.createSpan({ cls: "ed-custom-tile-label", text: item.label.trim() || item.target });
      const n = item.kind === "folder" ? countFolder(ctx, item.target) : countTag(ctx, item.target);
      el.createDiv({ cls: "ed-custom-tile-num", text: String(n) });
    } else {
      mark(el, item);
      el.createSpan({ cls: "ed-custom-btn-label", text: item.label.trim() || item.target });
    }
    el.onclick = () => activate(ctx, item);
  }
}
