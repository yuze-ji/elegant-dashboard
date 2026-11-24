import { setIcon } from "obsidian";
import { VOCAB_BOX_DAYS, VOCAB_MASTERED_BOX, VocabItem } from "../types";
import { Ctx, HoverTooltip, card, empty, notifyUndo } from "../ui";
import { addDays, daysBetween, startOfDay, startOfIsoWeek, startOfMonth, toKey } from "../dates";
import { VocabEditModal } from "../modals";
import { runLookup } from "../lookup";
import { renderScriptChart, renderScriptTest } from "./scripts";
import {
  Store,
  addVocab,
  defaultVocabLang,
  deleteVocab,
  resetVocab,
  restoreVocab,
  reviewVocab,
  updateVocab,
} from "../mutations";
import { kanaReading, langTag, speak, speakButton } from "../speech";

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

/** Word-cloud text colours: soft, readable on both light and dark cards. */
const CLOUD_COLORS = [
  "#7FB3D5", "#C39BD3", "#F1948A", "#F7B267", "#82C9A0", "#F0C75E",
  "#5DADE2", "#AF7AC5", "#EC7063", "#58B8A0", "#E59866", "#9B8FD9",
];

/** How many of the hardest words the stats card lists. */
const HARDEST_LIMIT = 5;

// ------------------------------------------------------------------ helpers

function dueWords(ctx: Ctx, todayKey: string): VocabItem[] {
  // Lowest box first: a word just missed (box 0) is the one most worth
  // seeing again before the long-interval ones; ties by due date so what
  // has waited longest comes first.
  return ctx.settings.vocab
    .filter((v) => v.due <= todayKey)
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due) || a.word.localeCompare(b.word));
}

/**
 * Consecutive days (counting back from today) with at least one card
 * answered. Today not having any yet does not break it — same rule as the
 * habit streak.
 */
function studyStreak(log: Record<string, { reviewed: number }>, today: Date): number {
  let day = today;
  if (!(log[toKey(day)]?.reviewed > 0)) day = addDays(day, -1);
  let streak = 0;
  while (log[toKey(day)]?.reviewed > 0) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

function langsOf(ctx: Ctx): string[] {
  // Settings list first, then any language still carried by a word but no
  // longer in the list, so nothing becomes unfilterable.
  const set = new Set<string>(ctx.settings.vocabLanguages);
  for (const v of ctx.settings.vocab) if (v.lang) set.add(v.lang);
  return [...set];
}

function openEdit(ctx: Ctx, store: Store, item: VocabItem) {
  const { t } = ctx;
  new VocabEditModal(ctx.app, ctx.settings.lang, {
    title: { cn: "编辑单词", en: "Edit word" },
    languages: langsOf(ctx),
    initial: { word: item.word, meaning: item.meaning, example: item.example, lang: item.lang },
    lookup: (w, l) => runLookup(ctx, w, l),
    onSubmit: async (draft) => {
      if (await updateVocab(store, item.id, draft)) ctx.refresh();
    },
    onDelete: async () => {
      const removed = await deleteVocab(store, item.id);
      if (!removed) return;
      ctx.refresh();
      notifyUndo(t.vocabDeleted, t.undo, async () => {
        await restoreVocab(store, removed);
        ctx.refresh();
      });
    },
  }).open();
}

// ------------------------------------------------------------ overview card

/**
 * The compact Overview card: today's three numbers (due, reviewed, new),
 * the study streak, a button into the review session and a one-line add
 * form — enough to file a word met in a lecture without leaving the page.
 */
export function renderLanguage(parent: HTMLElement, ctx: Ctx) {
  const { t, settings } = ctx;
  const root = card(parent, `🌍 ${t.language}`);
  root.addClass("ed-vocab");
  const store = storeOf(ctx);

  const today = startOfDay(new Date());
  const todayKey = toKey(today);
  const due = dueWords(ctx, todayKey);
  const log = settings.vocabLog[todayKey] ?? { reviewed: 0, added: 0 };

  renderStatRow(root, ctx, due.length, log);

  const streak = studyStreak(settings.vocabLog, today);
  const actions = root.createDiv({ cls: "ed-vocab-actions" });
  if (streak > 0) actions.createSpan({ cls: "ed-vocab-streak", text: t.vocabStreak(streak) });
  if (due.length > 0) {
    const go = actions.createEl("button", {
      cls: "ed-btn ed-btn-compact",
      text: `${t.vocabStartReview} (${due.length})`,
    });
    go.onclick = () => ctx.navigate?.("language");
  } else {
    actions.createSpan({ cls: "ed-vocab-nothing", text: nextDueText(ctx, today) });
  }

  renderAddRow(root, ctx, store, { compact: true });
}

function nextDueText(ctx: Ctx, today: Date): string {
  const { t, settings } = ctx;
  if (settings.vocab.length === 0) return t.vocabEmpty;
  const upcoming = settings.vocab
    .map((v) => v.due)
    .filter((d) => d > toKey(today))
    .sort();
  if (upcoming.length === 0) return t.vocabNothingDue;
  const next = upcoming[0];
  const n = upcoming.filter((d) => d === next).length;
  return t.vocabNextDue(n, daysBetween(today, new Date(next + "T00:00:00")));
}

function renderStatRow(
  parent: HTMLElement,
  ctx: Ctx,
  dueCount: number,
  log: { reviewed: number; added: number }
) {
  const { t, settings } = ctx;
  const row = parent.createDiv({ cls: "ed-vocab-stats" });
  const stat = (label: string, value: string, met?: boolean) => {
    const s = row.createDiv({ cls: "ed-vocab-stat" });
    const v = s.createDiv({ cls: "ed-vocab-stat-value", text: value });
    if (met) v.addClass("is-met");
    s.createDiv({ cls: "ed-vocab-stat-label", text: label });
  };
  stat(t.vocabDue, String(dueCount), dueCount === 0);
  const rGoal = settings.vocabReviewPerDay;
  stat(
    t.vocabReviewedToday,
    rGoal > 0 ? t.vocabGoal(log.reviewed, rGoal) : String(log.reviewed),
    rGoal > 0 && log.reviewed >= rGoal
  );
  const nGoal = settings.vocabNewPerDay;
  stat(
    t.vocabNewToday,
    nGoal > 0 ? t.vocabGoal(log.added, nGoal) : String(log.added),
    nGoal > 0 && log.added >= nGoal
  );
}

// -------------------------------------------------------------------- page

/**
 * The Language page: the flashcard session on top (only while something
 * is due), then the word list with search and language filter, then the
 * stats card. Same "compact card on Overview, the whole thing on its own
 * page" split as Habits and Deadlines.
 */
export function renderLanguagePage(parent: HTMLElement, ctx: Ctx) {
  renderReviewCard(parent, ctx);
  renderWordWall(parent, ctx);
  renderWordList(parent, ctx);
  renderStatsCard(parent, ctx);
  renderScriptChart(parent, ctx);
  renderScriptTest(parent, ctx);
}

/**
 * The session is a queue built once per render from what's due. A miss
 * pushes the card to the back of the queue (its `due` stays today), so
 * the session only ends once every card has been answered right — the
 * DOM is updated in place rather than re-rendering the page, or the queue
 * would rebuild and the back-of-queue ordering would be lost.
 */
function renderReviewCard(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const store = storeOf(ctx);
  const today = startOfDay(new Date());
  const queue = dueWords(ctx, toKey(today));
  const root = card(parent, `🌍 ${t.vocabReview}`);
  root.addClass("ed-vocab-review");

  if (queue.length === 0) {
    empty(root, ctx.settings.vocab.length === 0 ? t.vocabEmpty : t.vocabAllDone);
    return;
  }

  const total = queue.length;
  let answered = 0;
  let right = 0;
  let revealed = false;

  const head = root.createDiv({ cls: "ed-vocab-review-head" });
  const progress = head.createSpan({ cls: "ed-vocab-progress" });
  const bar = head.createDiv({ cls: "ed-vocab-bar" });
  const fill = bar.createDiv({ cls: "ed-vocab-bar-fill" });

  const face = root.createDiv({ cls: "ed-vocab-card" });
  face.tabIndex = 0;
  const front = face.createDiv({ cls: "ed-vocab-card-front" });
  const back = face.createDiv({ cls: "ed-vocab-card-back" });
  const hint = face.createDiv({ cls: "ed-vocab-card-hint", text: t.vocabReveal });

  const btns = root.createDiv({ cls: "ed-vocab-answer" });
  const forgot = btns.createEl("button", { cls: "ed-btn ed-vocab-btn-forgot", text: `✗ ${t.vocabForgot}` });
  const knew = btns.createEl("button", { cls: "ed-btn ed-vocab-btn-knew", text: `✓ ${t.vocabKnew}` });

  const setProgress = () => {
    progress.setText(t.vocabProgress(answered, total));
    fill.style.width = `${Math.round((answered / total) * 100)}%`;
  };

  const show = () => {
    const item = queue[0];
    revealed = false;
    face.removeClass("is-revealed");
    front.empty();
    front.createSpan({ cls: "ed-vocab-chip", text: item.lang });
    front.createDiv({ cls: "ed-vocab-word", text: item.word });
    if (ctx.settings.speakAloud) speakButton(front, t.speak, () => speakWord(item.word, item.meaning, item.lang));
    back.empty();
    back.createDiv({ cls: "ed-vocab-meaning", text: item.meaning });
    if (item.example) back.createDiv({ cls: "ed-vocab-example", text: item.example });
    back.createDiv({
      cls: "ed-vocab-box-note",
      text: item.box >= VOCAB_MASTERED_BOX ? t.vocabMastered : t.vocabBox(item.box),
    });
    hint.show();
    forgot.disabled = true;
    knew.disabled = true;
    setProgress();
  };

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    face.addClass("is-revealed");
    hint.hide();
    forgot.disabled = false;
    knew.disabled = false;
  };

  const finish = () => {
    root.empty();
    root.createDiv({ cls: "ed-card-title", text: `🌍 ${t.vocabReview}` });
    const done = root.createDiv({ cls: "ed-vocab-done" });
    done.createDiv({ cls: "ed-vocab-done-title", text: t.vocabAllDone });
    done.createDiv({ cls: "ed-vocab-done-sub", text: t.vocabSessionDone(right, total) });
    // The counts on the other cards (and the Overview) are stale now.
    window.setTimeout(() => ctx.refresh(), 1500);
  };

  const answer = async (correct: boolean) => {
    if (!revealed) return;
    const item = queue.shift();
    if (!item) return;
    forgot.disabled = true;
    knew.disabled = true;
    if (!(await reviewVocab(store, item.id, correct))) {
      ctx.refresh();
      return;
    }
    if (correct) {
      answered++;
      right++;
    } else {
      queue.push(item);
    }
    if (queue.length === 0) finish();
    else show();
  };

  face.onclick = reveal;
  forgot.onclick = () => void answer(false);
  knew.onclick = () => void answer(true);

  // Space flips, 1 / 2 (or ← / →) answer — a review should not need the mouse.
  const onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (!root.isConnected) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      reveal();
    } else if (e.key === "1" || e.key === "ArrowLeft") {
      e.preventDefault();
      void answer(false);
    } else if (e.key === "2" || e.key === "ArrowRight") {
      e.preventDefault();
      void answer(true);
    }
  };
  document.addEventListener("keydown", onKey);
  ctx.onCleanup(() => document.removeEventListener("keydown", onKey));

  show();
}

/**
 * Every word added in a period, scattered over the card like a word cloud:
 * random spots, random slight tilt, size following the Leitner box (a word
 * grows as it is learned), colour following the language. Hover for the
 * meaning and date, click to edit, "shuffle" to re-scatter. A view of
 * growth, not a tool — the list below is for working.
 */
function renderWordWall(parent: HTMLElement, ctx: Ctx) {
  const { t, settings } = ctx;
  const store = storeOf(ctx);
  const root = card(parent, `🧱 ${t.vocabWall}`);
  root.addClass("ed-vocab-wall-card");
  const today = startOfDay(new Date());

  type Range = "today" | "week" | "month" | "all";
  let range: Range = settings.vocab.some((v) => v.createdAt === toKey(today)) ? "today" : "all";
  const since = (r: Range): string => {
    if (r === "today") return toKey(today);
    if (r === "week") return toKey(startOfIsoWeek(today));
    if (r === "month") return toKey(startOfMonth(today));
    return "";
  };
  const labels: Record<Range, string> = {
    today: t.vocabWallToday,
    week: t.vocabWallWeek,
    month: t.vocabWallMonth,
    all: t.vocabWallAll,
  };

  const head = root.createDiv({ cls: "ed-vocab-wall-head" });
  const tabs = head.createDiv({ cls: "ed-script-tabs" });
  const shuffleBtn = head.createEl("button", {
    cls: "ed-btn ed-btn-compact ed-btn-ghost",
    text: `🔀 ${t.vocabWallShuffle}`,
  });
  const wall = root.createDiv({ cls: "ed-vocab-wall" });
  const tooltip = new HoverTooltip(ctx.onCleanup);
  const drawTabs = () => {
    tabs.empty();
    for (const r of ["today", "week", "month", "all"] as Range[]) {
      const n = settings.vocab.filter((v) => v.createdAt >= since(r)).length;
      const b = tabs.createEl("button", { cls: "ed-script-tab", text: `${labels[r]} ${n}` });
      if (r === range) b.addClass("is-active");
      b.onclick = () => {
        range = r;
        drawTabs();
        draw();
      };
    }
  };

  /**
   * Scatter: each word gets a random spot that doesn't overlap one already
   * placed (a padded-rectangle test over up to 80 tries, biggest words
   * first so they get the open space); when the area is too full, it
   * grows taller and the word tries again. Positions are measured against
   * the card's real width, so the layout runs after the wall is in the DOM.
   */
  const scatter = (bricks: HTMLElement[]) => {
    const width = wall.clientWidth || 600;
    const pad = 3;
    // Start from the words' own area so the cloud packs tight; grow only
    // when a word really cannot find a gap.
    const area = bricks.reduce((s, b) => s + (b.offsetWidth + pad) * (b.offsetHeight + pad), 0);
    let height = Math.max(120, Math.round((area / width) * 1.35));
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const overlaps = (r: { x: number; y: number; w: number; h: number }) =>
      placed.some(
        (p) =>
          r.x < p.x + p.w + pad && r.x + r.w + pad > p.x && r.y < p.y + p.h + pad && r.y + r.h + pad > p.y
      );
    for (const b of bricks) {
      const w = b.offsetWidth;
      const h = b.offsetHeight;
      let spot: { x: number; y: number; w: number; h: number } | null = null;
      for (let grow = 0; grow < 8 && !spot; grow++) {
        for (let i = 0; i < 200; i++) {
          const r = {
            x: Math.random() * Math.max(1, width - w),
            y: Math.random() * Math.max(1, height - h),
            w,
            h,
          };
          if (!overlaps(r)) {
            spot = r;
            break;
          }
        }
        if (!spot) height += Math.max(24, h);
      }
      if (!spot) spot = { x: 0, y: height, w, h }; // give up: drop it below
      placed.push(spot);
      b.style.left = `${Math.round(spot.x)}px`;
      b.style.top = `${Math.round(spot.y)}px`;
      b.style.visibility = "visible";
    }
    wall.style.height = `${height + 6}px`;
  };

  const draw = () => {
    wall.empty();
    wall.style.height = "";
    const from = since(range);
    const words = settings.vocab
      .filter((v) => v.createdAt >= from)
      .sort((a, b) => b.box - a.box || b.createdAt.localeCompare(a.createdAt));
    if (words.length === 0) {
      empty(wall, t.vocabWallEmpty);
      return;
    }
    const bricks: HTMLElement[] = [];
    for (const v of words) {
      const brick = wall.createSpan({ cls: "ed-vocab-brick", text: v.word });
      brick.style.visibility = "hidden";
      bricks.push(brick);
      brick.dataset.box = String(v.box);
      // A random pastel per word, like a classic tag cloud; the language
      // is in the tooltip rather than the colour.
      brick.style.color = CLOUD_COLORS[Math.floor(Math.random() * CLOUD_COLORS.length)];
      if (v.due <= toKey(today)) brick.addClass("is-due");
      brick.addEventListener("mouseenter", () => {
        tooltip.el.empty();
        tooltip.el.createDiv({ cls: "ed-tooltip-date", text: `${v.word} · ${v.lang}` });
        tooltip.el.createDiv({ cls: "ed-tooltip-count", text: v.meaning });
        tooltip.el.createDiv({
          cls: "ed-tooltip-count",
          text: `${t.vocabWallAdded(v.createdAt)} · ${v.box >= VOCAB_MASTERED_BOX ? t.vocabMastered : t.vocabBox(v.box)}`,
        });
        tooltip.show();
      });
      brick.addEventListener("mousemove", (e: MouseEvent) => tooltip.move(e));
      brick.addEventListener("mouseleave", () => tooltip.hide());
      brick.onclick = () => openEdit(ctx, store, v);
    }
    // Layout needs real widths: wait for the card to be in the DOM. A
    // timeout, not requestAnimationFrame — Electron stops animation frames
    // while the window is hidden, and the view may well render then.
    window.setTimeout(() => scatter(bricks), 0);
  };

  shuffleBtn.onclick = draw;
  drawTabs();
  draw();
}

function renderWordList(parent: HTMLElement, ctx: Ctx) {
  const { t, settings } = ctx;
  const store = storeOf(ctx);
  const root = card(parent, `📖 ${t.vocabWordList}`);
  root.addClass("ed-vocab-list-card");
  const today = startOfDay(new Date());
  const todayKey = toKey(today);

  const tools = root.createDiv({ cls: "ed-vocab-tools" });
  const search = tools.createEl("input", { cls: "ed-add-input", type: "search" });
  search.placeholder = t.vocabSearch;
  const langSel = tools.createEl("select", { cls: "ed-vocab-select" });
  langSel.createEl("option", { value: "", text: t.vocabAllLanguages });
  for (const l of langsOf(ctx)) langSel.createEl("option", { value: l, text: l });

  const list = root.createDiv({ cls: "ed-vocab-list" });

  const draw = () => {
    list.empty();
    const q = search.value.trim().toLowerCase();
    const lang = langSel.value;
    const items = settings.vocab
      .filter((v) => !lang || v.lang === lang)
      .filter(
        (v) =>
          !q ||
          v.word.toLowerCase().includes(q) ||
          v.meaning.toLowerCase().includes(q) ||
          v.example.toLowerCase().includes(q)
      )
      // Due first, then by box (shakiest first), then newest.
      .sort(
        (a, b) =>
          Number(b.due <= todayKey) - Number(a.due <= todayKey) ||
          a.box - b.box ||
          b.createdAt.localeCompare(a.createdAt)
      );
    if (items.length === 0) {
      empty(list, settings.vocab.length === 0 ? t.vocabEmpty : "—");
      return;
    }
    for (const v of items) renderWordRow(list, ctx, store, v, today);
  };

  search.oninput = draw;
  langSel.onchange = draw;
  draw();

  renderAddRow(root, ctx, store, { compact: false });
}

/** Japanese words are read by their kana (from "八（はち / や）") when the
 *  meaning gives one; otherwise the word itself. */
function speakWord(word: string, meaning: string, lang: string) {
  const tag = langTag(lang, word);
  const text = tag === "ja-JP" ? kanaReading(meaning) ?? word : word;
  speak(text, tag);
}

function renderWordRow(list: HTMLElement, ctx: Ctx, store: Store, v: VocabItem, today: Date) {
  const { t } = ctx;
  const row = list.createDiv({ cls: "ed-vocab-row" });
  const isDue = v.due <= toKey(today);
  if (isDue) row.addClass("is-due");

  const main = row.createDiv({ cls: "ed-vocab-row-main" });
  const top = main.createDiv({ cls: "ed-vocab-row-top" });
  top.createSpan({ cls: "ed-vocab-row-word", text: v.word });
  top.createSpan({ cls: "ed-vocab-chip", text: v.lang });
  if (ctx.settings.speakAloud) speakButton(top, t.speak, () => speakWord(v.word, v.meaning, v.lang));
  main.createDiv({ cls: "ed-vocab-row-meaning", text: v.meaning });
  if (v.example) main.createDiv({ cls: "ed-vocab-row-example", text: v.example });

  const side = row.createDiv({ cls: "ed-vocab-row-side" });
  const box = side.createSpan({ cls: "ed-vocab-boxpill" });
  box.dataset.box = String(v.box);
  box.setText(v.box >= VOCAB_MASTERED_BOX ? t.vocabMastered : t.vocabBox(v.box));
  const when = side.createSpan({ cls: "ed-vocab-row-due" });
  if (isDue) {
    when.setText(t.vocabDueBadge);
    when.addClass("is-due");
  } else {
    when.setText(t.vocabDueIn(daysBetween(today, new Date(v.due + "T00:00:00"))));
  }
  if (v.lapses > 0) side.createSpan({ cls: "ed-vocab-row-lapses", text: t.vocabLapses(v.lapses) });

  const edit = side.createEl("button", { cls: "ed-icon-btn ed-vocab-row-btn" });
  setIcon(edit, "pencil");
  edit.setAttr("aria-label", t.vocabEdit);
  edit.onclick = () => openEdit(ctx, store, v);

  if (v.box > 0) {
    const reset = side.createEl("button", { cls: "ed-icon-btn ed-vocab-row-btn" });
    setIcon(reset, "rotate-ccw");
    reset.setAttr("aria-label", t.vocabReset);
    reset.setAttr("title", t.vocabReset);
    reset.onclick = async () => {
      if (await resetVocab(store, v.id)) ctx.refresh();
    };
  }

  const del = side.createEl("button", { cls: "ed-icon-btn ed-vocab-row-btn ed-vocab-del" });
  setIcon(del, "trash-2");
  del.setAttr("aria-label", t.vocabDelete);
  del.onclick = async () => {
    const removed = await deleteVocab(store, v.id);
    if (!removed) return;
    ctx.refresh();
    notifyUndo(t.vocabDeleted, t.undo, async () => {
      await restoreVocab(store, removed);
      ctx.refresh();
    });
  };
}

function renderStatsCard(parent: HTMLElement, ctx: Ctx) {
  const { t, settings } = ctx;
  const root = card(parent, `📊 ${t.vocabStats}`);
  root.addClass("ed-vocab-stats-card");
  const words = settings.vocab;
  if (words.length === 0) {
    empty(root, t.vocabEmpty);
    return;
  }

  const mastered = words.filter((v) => v.box >= VOCAB_MASTERED_BOX).length;
  const row = root.createDiv({ cls: "ed-vocab-stats" });
  const stat = (label: string, value: number) => {
    const s = row.createDiv({ cls: "ed-vocab-stat" });
    s.createDiv({ cls: "ed-vocab-stat-value", text: String(value) });
    s.createDiv({ cls: "ed-vocab-stat-label", text: label });
  };
  stat(t.vocabTotal, words.length);
  stat(t.vocabLearning, words.length - mastered);
  stat(t.vocabMasteredCount, mastered);

  // Per-box distribution as one stacked bar, box 0 on the left: a deck
  // that is mostly left-heavy is being fed faster than it is learned.
  const counts = VOCAB_BOX_DAYS.map((_, i) => words.filter((v) => v.box === i).length);
  root.createDiv({ cls: "ed-vocab-legend", text: t.vocabBoxLegend });
  const bar = root.createDiv({ cls: "ed-vocab-dist" });
  counts.forEach((n, i) => {
    if (n === 0) return;
    const seg = bar.createDiv({ cls: "ed-vocab-dist-seg" });
    seg.dataset.box = String(i);
    seg.style.flexGrow = String(n);
    seg.setAttr("title", `${i >= VOCAB_MASTERED_BOX ? t.vocabMastered : t.vocabBox(i)}: ${n}`);
    if (n / words.length > 0.08) seg.setText(String(n));
  });

  const hard = words
    .filter((v) => v.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.box - b.box)
    .slice(0, HARDEST_LIMIT);
  if (hard.length > 0) {
    root.createDiv({ cls: "ed-vocab-legend", text: t.vocabHardest });
    const ul = root.createDiv({ cls: "ed-vocab-hard" });
    for (const v of hard) {
      const li = ul.createDiv({ cls: "ed-vocab-hard-row" });
      li.createSpan({ cls: "ed-vocab-row-word", text: v.word });
      li.createSpan({ cls: "ed-vocab-row-meaning", text: v.meaning });
      li.createSpan({ cls: "ed-vocab-row-lapses", text: t.vocabLapses(v.lapses) });
    }
  }
}

// ----------------------------------------------------------------- add row

function renderAddRow(root: HTMLElement, ctx: Ctx, store: Store, opts: { compact: boolean }) {
  const { t } = ctx;
  const row = root.createDiv({ cls: "ed-add-row ed-vocab-add" });

  const word = row.createEl("input", { cls: "ed-add-input ed-vocab-add-word", type: "text" });
  word.placeholder = t.vocabWordPlaceholder;
  const meaning = row.createEl("input", { cls: "ed-add-input", type: "text" });
  meaning.placeholder = t.vocabMeaningPlaceholder;
  let example: HTMLInputElement | null = null;
  if (!opts.compact) {
    example = row.createEl("input", { cls: "ed-add-input ed-vocab-add-example", type: "text" });
    example.placeholder = t.vocabExamplePlaceholder;
  }
  const langSel = row.createEl("select", { cls: "ed-vocab-select" });
  for (const l of ctx.settings.vocabLanguages) langSel.createEl("option", { value: l, text: l });
  langSel.value = defaultVocabLang(ctx.settings);

  // Fills whichever of meaning / example is still empty; never overwrites.
  const lookupBtn = row.createEl("button", { cls: "ed-btn ed-btn-compact ed-btn-ghost", text: `🔍 ${t.vocabLookup}` });
  const lookup = async () => {
    if (!word.value.trim()) {
      word.focus();
      return;
    }
    lookupBtn.disabled = true;
    lookupBtn.setText(t.vocabLookupBusy);
    const r = await runLookup(ctx, word.value, langSel.value);
    lookupBtn.disabled = false;
    lookupBtn.setText(`🔍 ${t.vocabLookup}`);
    if (!r) return;
    // Typed in Chinese: the translation becomes the word, the input the meaning.
    if (r.word && r.word !== word.value.trim()) {
      if (!meaning.value.trim()) meaning.value = r.meaning || word.value.trim();
      word.value = r.word;
    } else if (!meaning.value.trim() && r.meaning) {
      meaning.value = r.meaning;
    }
    if (example && !example.value.trim() && r.example) example.value = r.example;
    meaning.focus();
  };
  lookupBtn.onclick = () => void lookup();

  const submit = async () => {
    const ok = await addVocab(store, {
      word: word.value,
      meaning: meaning.value,
      example: example?.value ?? "",
      lang: langSel.value,
    });
    if (ok) {
      word.value = "";
      meaning.value = "";
      if (example) example.value = "";
      ctx.refresh();
    } else if (!word.value.trim()) {
      word.focus();
    } else {
      meaning.focus();
    }
  };

  // Enter in the word box with an empty meaning looks the word up rather
  // than submitting (which would fail anyway); Enter anywhere else submits.
  word.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (meaning.value.trim()) void submit();
    else void lookup();
  });
  for (const el of [meaning, example]) {
    el?.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    });
  }

  const addBtn = row.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.vocabAdd });
  addBtn.onclick = () => void submit();
}
