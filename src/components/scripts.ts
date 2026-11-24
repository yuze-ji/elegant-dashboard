import { Ctx, autoFocusForStudy, card } from "../ui";
import { MIXED_WITH, SCRIPTS, SCRIPT_IDS, ScriptChar, ScriptId, allChars } from "../scripts";
import { SCRIPT_LANGS, Store, recordScriptAnswer } from "../mutations";
import { SCRIPT_LANG, speak, speakButton } from "../speech";

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

/** A character counts as weak below this accuracy (once it has been seen). */
const WEAK_BELOW = 0.8;

const keyOf = (script: ScriptId, c: ScriptChar) => `${script}:${c.ch}`;

type Rec = { right: number; wrong: number } | undefined;

function accuracy(rec: Rec): number | null {
  if (!rec || rec.right + rec.wrong === 0) return null;
  return rec.right / (rec.right + rec.wrong);
}

function isWeak(ctx: Ctx, script: ScriptId, c: ScriptChar): boolean {
  const a = accuracy(ctx.settings.scriptLog[keyOf(script, c)]);
  return a !== null && a < WEAK_BELOW;
}

// ------------------------------------------------------------------ chart

/**
 * Kana and hangul reference charts — a lookup table, nothing more. Cells
 * are tinted by the test record (green / amber / red) so the chart doubles
 * as a progress map. Which script is shown is kept on the card, not in
 * settings: a view choice, not data.
 */
export function renderScriptChart(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const root = card(parent, `🈁 ${t.scripts}`);
  root.addClass("ed-script-card");
  let script: ScriptId = "hiragana";

  const tabs = root.createDiv({ cls: "ed-script-tabs" });
  const body = root.createDiv({ cls: "ed-script-body" });

  const drawTabs = () => {
    tabs.empty();
    for (const id of SCRIPT_IDS) {
      const b = tabs.createEl("button", { cls: "ed-script-tab", text: t.scriptNames[id] });
      if (id === script) b.addClass("is-active");
      b.onclick = () => {
        script = id;
        drawTabs();
        drawChart();
      };
    }
  };

  const drawChart = () => {
    body.empty();
    const log = ctx.settings.scriptLog;
    for (const section of SCRIPTS[script]) {
      body.createDiv({ cls: "ed-script-section", text: t.scriptSections[section.key] ?? section.key });
      const grid = body.createDiv({ cls: "ed-script-grid" });
      const cols = Math.max(...section.rows.map((r) => r.length));
      grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      if (cols >= 10) grid.addClass("is-dense");
      for (const row of section.rows) {
        for (let i = 0; i < cols; i++) {
          const c = row[i] ?? null;
          const cell = grid.createDiv({ cls: "ed-script-cell is-static" });
          if (!c) {
            cell.addClass("is-blank");
            continue;
          }
          const rec = log[keyOf(script, c)];
          const a = accuracy(rec);
          if (a !== null) cell.dataset.level = a < 0.5 ? "weak" : a < WEAK_BELOW ? "shaky" : "ok";
          cell.createDiv({ cls: "ed-script-ch", text: c.ch });
          cell.createDiv({ cls: "ed-script-read", text: c.read });
          if (c.twin) cell.createDiv({ cls: "ed-script-twin", text: c.twin });
          const stat = rec ? t.scriptAccuracy(rec.right, rec.right + rec.wrong) : t.scriptUnseen;
          cell.setAttr("title", ctx.settings.speakAloud ? `${stat} · ${t.speak}` : stat);
          if (ctx.settings.speakAloud) cell.onclick = () => speak(c.ch, SCRIPT_LANG[script]);
        }
      }
    }
  };

  drawTabs();
  drawChart();
}

// ------------------------------------------------------------------- test

type Mode = "read" | "write";
type Item = ScriptChar & { script: ScriptId };

/**
 * Hepburn is the chart's spelling; Kunrei / wāpuro spellings of the same
 * sound are accepted too, so せ→"se" and し→"si" both count. Keyed by
 * the chart reading, listing the extra forms.
 */
const KANA_ALT: Record<string, string[]> = {
  shi: ["si"], chi: ["ti"], tsu: ["tu"], fu: ["hu"], ji: ["zi", "di"], zu: ["du"],
  sha: ["sya"], shu: ["syu"], sho: ["syo"], cha: ["tya"], chu: ["tyu"], cho: ["tyo"],
  ja: ["zya", "jya"], ju: ["zyu", "jyu"], jo: ["zyo", "jyo"], wo: ["o"], n: ["nn"],
};

/** Every spelling that counts as right for a reading. */
function acceptedReadings(read: string): string[] {
  // Korean letters list two values ("g/k", "ng / -"); any one is fine.
  const parts = read.split("/").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
  const out = new Set<string>();
  for (const p of parts) {
    out.add(p);
    for (const alt of KANA_ALT[p] ?? []) out.add(alt);
  }
  return [...out];
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");

/** Compare typed kana to the expected one; the other script's twin is
 *  wrong on purpose — the question said which script to write. */
const sameChar = (typed: string, c: ScriptChar) => normalize(typed) === normalize(c.ch);

/**
 * The typed test. Settings row first (range, mode, how many), then one
 * question at a time with an input box: Enter checks, Enter again moves
 * on. Every answer updates the character's tally (which tints the chart);
 * the summary lists what was missed and offers to retest just those.
 */
export function renderScriptTest(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const root = card(parent, `✍️ ${t.scriptTest}`);
  root.addClass("ed-script-test");
  const body = root.createDiv();

  let script: ScriptId = "hiragana";
  let range: "all" | "weak" | "mixed" = "all";
  let mode: Mode = "read";
  let count = 20;

  const pool = (): Item[] => {
    const scripts = range === "mixed" ? MIXED_WITH[script] : [script];
    let items: Item[] = scripts.flatMap((s) => allChars(s).map((c) => ({ ...c, script: s })));
    if (range === "weak") items = items.filter((c) => isWeak(ctx, c.script, c));
    return items;
  };

  const drawSetup = () => {
    body.empty();
    const form = body.createDiv({ cls: "ed-script-form" });

    const field = (label: string) => {
      const f = form.createDiv({ cls: "ed-script-field" });
      f.createSpan({ cls: "ed-script-field-label", text: label });
      return f;
    };

    const rangeF = field(t.scriptTestRange);
    const scriptSel = rangeF.createEl("select", { cls: "ed-vocab-select" });
    for (const id of SCRIPT_IDS) scriptSel.createEl("option", { value: id, text: t.scriptNames[id] });
    scriptSel.value = script;
    scriptSel.onchange = () => {
      script = scriptSel.value as ScriptId;
      updateStart();
    };
    const rangeSel = rangeF.createEl("select", { cls: "ed-vocab-select" });
    rangeSel.createEl("option", { value: "all", text: t.scriptTestCountAll });
    rangeSel.createEl("option", { value: "weak", text: t.scriptTestWeak });
    rangeSel.createEl("option", { value: "mixed", text: t.scriptTestMixed });
    rangeSel.value = range;
    rangeSel.onchange = () => {
      range = rangeSel.value as typeof range;
      updateStart();
    };

    const modeF = field(t.scriptTestMode);
    const modeSel = modeF.createEl("select", { cls: "ed-vocab-select" });
    modeSel.createEl("option", { value: "read", text: t.scriptTestModeRead });
    modeSel.createEl("option", { value: "write", text: t.scriptTestModeWrite });
    modeSel.value = mode;
    modeSel.onchange = () => (mode = modeSel.value as Mode);

    const countF = field(t.scriptTestCount);
    const countSel = countF.createEl("select", { cls: "ed-vocab-select" });
    for (const n of [10, 20, 50]) countSel.createEl("option", { value: String(n), text: String(n) });
    countSel.createEl("option", { value: "0", text: t.scriptTestCountAll });
    countSel.value = String(count);
    countSel.onchange = () => (count = Number(countSel.value));

    const start = form.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.scriptTestStart });
    const updateStart = () => {
      const n = pool().length;
      start.disabled = n === 0;
      start.setText(`${t.scriptTestStart} (${n})`);
    };
    updateStart();
    start.onclick = () => {
      const items = shuffle(pool());
      if (items.length === 0) return;
      void autoFocusForStudy(ctx, SCRIPT_LANGS[script] ?? []);
      drawQuiz(count > 0 ? items.slice(0, count) : items);
    };
  };

  const drawQuiz = (queue: Item[]) => {
    body.empty();
    const store = storeOf(ctx);
    const total = queue.length;
    let index = 0;
    let right = 0;
    const missed: Item[] = [];
    let checked = false;

    const head = body.createDiv({ cls: "ed-vocab-review-head" });
    const progress = head.createSpan({ cls: "ed-vocab-progress" });
    const bar = head.createDiv({ cls: "ed-vocab-bar" });
    const fill = bar.createDiv({ cls: "ed-vocab-bar-fill" });
    const stop = head.createEl("button", { cls: "ed-btn ed-btn-compact ed-btn-ghost", text: t.scriptStop });
    stop.onclick = drawSetup;

    const face = body.createDiv({ cls: "ed-vocab-card ed-script-face is-static" });
    const ask = face.createDiv({ cls: "ed-script-ask" });
    const prompt = face.createDiv({ cls: "ed-vocab-word ed-script-big" });
    const sayNow = () => speak(queue[index].ch, SCRIPT_LANG[queue[index].script]);
    const speakBtn = ctx.settings.speakAloud ? speakButton(face, t.speak, sayNow) : null;
    const twin = face.createDiv({ cls: "ed-script-twin-hint" });
    const verdict = face.createDiv({ cls: "ed-script-verdict" });

    const inputRow = body.createDiv({ cls: "ed-script-input-row" });
    const input = inputRow.createEl("input", { cls: "ed-add-input ed-script-input", type: "text" });
    input.setAttr("autocomplete", "off");
    input.setAttr("autocapitalize", "off");
    input.setAttr("spellcheck", "false");
    const btn = inputRow.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.scriptTestCheck });

    const show = () => {
      const c = queue[index];
      checked = false;
      verdict.empty();
      verdict.removeClass("is-right");
      verdict.removeClass("is-wrong");
      twin.setText("");
      speakBtn?.toggleClass("is-hidden", mode !== "read");
      if (mode === "read") {
        ask.setText(t.scriptTestAskRead);
        prompt.setText(c.ch);
      } else {
        ask.setText(t.scriptTestAskWrite(t.scriptNames[c.script]));
        prompt.setText(c.read);
        // Syllables carry their decomposition as the twin — a hint that
        // gives the answer away, so only kana show theirs (after checking).
      }
      input.value = "";
      input.disabled = false;
      btn.setText(t.scriptTestCheck);
      progress.setText(t.vocabProgress(index, total));
      fill.style.width = `${Math.round((index / total) * 100)}%`;
      input.focus();
    };

    const check = async () => {
      const c = queue[index];
      const typed = input.value;
      if (!typed.trim()) return;
      const ok =
        mode === "read" ? acceptedReadings(c.read).includes(normalize(typed)) : sameChar(typed, c);
      checked = true;
      input.disabled = true;
      verdict.toggleClass("is-right", ok);
      verdict.toggleClass("is-wrong", !ok);
      verdict.setText(ok ? t.scriptTestCorrect : t.scriptTestWrong(mode === "read" ? c.read : c.ch));
      if (c.twin && c.script !== "hangulSyllables") twin.setText(c.twin);
      // Hear the answer once it is on screen (write mode reveals it here).
      speakBtn?.removeClass("is-hidden");
      if (ctx.settings.speakAloud) sayNow();
      if (ok) right++;
      else missed.push(c);
      btn.setText(t.scriptTestNext);
      btn.focus();
      await recordScriptAnswer(store, keyOf(c.script, c), ok);
    };

    const next = () => {
      index++;
      if (index >= total) finish();
      else show();
    };

    const finish = () => {
      body.empty();
      const done = body.createDiv({ cls: "ed-vocab-done" });
      done.createDiv({ cls: "ed-vocab-done-title", text: t.scriptTestDone(right, total) });
      if (missed.length > 0) {
        done.createDiv({ cls: "ed-vocab-done-sub", text: t.scriptTestWrongList });
        const list = done.createDiv({ cls: "ed-script-missed" });
        for (const c of missed) {
          const chip = list.createSpan({ cls: "ed-script-missed-chip" });
          chip.setText(`${c.ch} ${c.read}`);
        }
      }
      const row = done.createDiv({ cls: "ed-vocab-answer" });
      if (missed.length > 0) {
        const again = row.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.scriptTestAgain });
        again.onclick = () => drawQuiz(shuffle(missed));
      }
      const back = row.createEl("button", { cls: "ed-btn ed-btn-compact ed-btn-ghost", text: t.scriptStop });
      back.onclick = drawSetup;
      // The chart above is stale now.
      window.setTimeout(() => ctx.refresh(), 1500);
    };

    btn.onclick = () => (checked ? next() : void check());
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (checked) next();
      else void check();
    });
    btn.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && checked) {
        e.preventDefault();
        next();
      }
    });

    show();
  };

  drawSetup();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
