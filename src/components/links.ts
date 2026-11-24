import { setIcon } from "obsidian";
import { Ctx, card, empty, notifyUndo } from "../ui";
import { newId } from "../types";
import { linkMark, openLink, setIconOr } from "./home";

/**
 * Bookmarks: GitHub, Hugging Face, mail, a course portal… Two renderings of
 * the same list (settings.homeLinks):
 *   - the optional Sites *module*: a row of buttons on the Overview;
 *   - the Web links *page*: big icon tiles, editable in place (add a row,
 *     delete on hover) — the same "card on Overview, page of its own" split
 *     Projects and Habits use.
 * A tile's mark is picked by host (linkMark) unless the label starts with
 * an emoji, which then is the mark.
 */

function splitLabel(link: { label: string; url: string }): { mark: string | null; text: string } {
  const label = link.label.trim() || link.url;
  const m = /^(\p{Extended_Pictographic})\s*/u.exec(label);
  return m ? { mark: m[1], text: label.slice(m[0].length) || link.url } : { mark: null, text: label };
}

function drawMark(el: HTMLElement, link: { label: string; url: string }) {
  const { mark } = splitLabel(link);
  if (mark) {
    el.setText(mark);
    return;
  }
  const m = linkMark(link.url);
  if (m.emoji) el.setText(m.emoji);
  else setIconOr(el, m.icon ?? "globe");
}

export function renderLinks(parent: HTMLElement, ctx: Ctx) {
  const { t, settings } = ctx;
  const root = card(parent, `🔗 ${t.homeLinks}`);
  root.addClass("ed-links");
  if (settings.homeLinks.length === 0) {
    empty(root, t.linksEmpty);
    return;
  }
  const row = root.createDiv({ cls: "ed-links-row" });
  for (const link of settings.homeLinks) {
    const b = row.createEl("button", { cls: "ed-home-shortcut ed-home-link" });
    drawMark(b.createSpan({ cls: "ed-home-link-mark" }), link);
    b.createSpan({ text: splitLabel(link).text });
    b.setAttr("title", link.url);
    b.onclick = () => openLink(ctx, link.url);
  }
}

export function renderLinksPage(parent: HTMLElement, ctx: Ctx) {
  const { t, settings } = ctx;
  const root = card(parent, `🔗 ${t.homeLinks}`);
  root.addClass("ed-links-page");

  if (settings.homeLinks.length === 0) {
    empty(root, t.linksEmpty);
  } else {
    const grid = root.createDiv({ cls: "ed-links-tiles" });
    settings.homeLinks.forEach((link, index) => {
      const tile = grid.createDiv({ cls: "ed-links-tile" });
      tile.setAttr("role", "button");
      tile.setAttr("tabindex", "0");
      tile.setAttr("title", link.url);
      drawMark(tile.createDiv({ cls: "ed-links-tile-mark" }), link);
      tile.createDiv({ cls: "ed-links-tile-label", text: splitLabel(link).text });
      tile.onclick = () => openLink(ctx, link.url);
      tile.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") openLink(ctx, link.url);
      });

      const del = tile.createEl("button", { cls: "ed-icon-btn ed-links-tile-del" });
      setIcon(del, "x");
      del.setAttr("aria-label", t.linksDelete);
      del.onclick = async (e) => {
        e.stopPropagation();
        settings.homeLinks.splice(index, 1);
        await ctx.save();
        ctx.refresh();
        notifyUndo(t.linksDeletedNotice, t.undo, async () => {
          settings.homeLinks.splice(Math.min(index, settings.homeLinks.length), 0, link);
          await ctx.save();
          ctx.refresh();
        });
      };
    });
  }

  // ---- add
  const addRow = root.createDiv({ cls: "ed-add-row" });
  const labelInput = addRow.createEl("input", { cls: "ed-add-input ed-links-add-label", type: "text" });
  labelInput.placeholder = t.linksAddLabel;
  const urlInput = addRow.createEl("input", { cls: "ed-add-input", type: "text" });
  urlInput.placeholder = t.linksAddUrl;
  const submit = async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    settings.homeLinks.push({ id: newId(), label: labelInput.value.trim(), url });
    await ctx.save();
    labelInput.value = "";
    urlInput.value = "";
    ctx.refresh();
  };
  for (const input of [labelInput, urlInput]) {
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    });
  }
  const addBtn = addRow.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.addDeadline });
  addBtn.onclick = () => void submit();
  root.createDiv({ cls: "ed-links-hint", text: t.linksHint });
}
