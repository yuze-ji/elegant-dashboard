import { Notice, requestUrl } from "obsidian";
import type { Strings } from "./i18n";
import type { Lang } from "./types";

/**
 * Free, key-less word lookup for the vocabulary module. Three sources, each
 * optional, none authoritative:
 *
 *   1. Google Translate's public "gtx" endpoint — the same one the browser
 *      extension uses; no key, but unofficial and could stop working.
 *   2. MyMemory (api.mymemory.translated.net) — a public translation memory
 *      with an anonymous quota (a few thousand characters a day); used only
 *      when (1) fails.
 *   3. English Wiktionary's REST API — a dictionary definition in English,
 *      and an example sentence in the word's own language where one exists.
 *
 * The result is a suggestion to fill empty fields with, never something
 * written to the deck on its own.
 */

export interface LookupResult {
  /** The word in the deck's language — the input itself, or, when the
   *  input was in the UI language, its translation. */
  word: string;
  meaning: string;
  example: string;
}

const hasHan = (s: string) => /[\u3400-\u9fff]/.test(s);
const hasKana = (s: string) => /[\u3040-\u30ff]/.test(s);

/** Language names (as typed in Settings) → ISO codes the services accept. */
const LANG_CODES: Array<[RegExp, string]> = [
  [/^(deutsch|german|德语|德文|de)$/i, "de"],
  [/^(english|英语|英文|en)$/i, "en"],
  [/^(日本語|japanese|日语|日文|ja)$/i, "ja"],
  [/^(한국어|korean|韩语|韓語|韩文|ko)$/i, "ko"],
  [/^(français|francais|french|法语|法文|fr)$/i, "fr"],
  [/^(español|espanol|spanish|西班牙语|es)$/i, "es"],
  [/^(italiano|italian|意大利语|it)$/i, "it"],
  [/^(português|portugues|portuguese|葡萄牙语|pt)$/i, "pt"],
  [/^(русский|russian|俄语|ru)$/i, "ru"],
  [/^(中文|汉语|chinese|zh|zh-cn)$/i, "zh-CN"],
];

export function langCode(name: string): string | null {
  const n = name.trim();
  for (const [re, code] of LANG_CODES) if (re.test(n)) return code;
  return null;
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Wiktionary renders Japanese furigana as ruby, which flattens to
 *  "漢(かん)字(じ)" — drop the kana-in-brackets so the sentence reads clean. */
const stripRuby = (s: string) => s.replace(/(?<=[\u3400-\u9fff])\(([\u3040-\u30ff]+)\)/g, "");

/** Scripts whose words a learner also needs the *reading* of. */
const READING_LANGS = new Set(["ja", "ko", "zh-CN", "ru"]);

interface Translation {
  /** "" when the service handed the input back unchanged. */
  text: string;
  /** Romanised reading of the *source* word (dt=rm), "" if none. */
  reading: string;
}

async function googleTranslate(word: string, from: string, to: string): Promise<Translation> {
  // dt=rm (the reading) nudges the translation itself for some pairs
  // ("Haus" → 房 instead of 房子), so only ask for it where it is wanted.
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
    (READING_LANGS.has(from) ? "&dt=rm" : "") +
    `&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(word)}`;
  const res = await requestUrl({ url, throw: false });
  if (res.status !== 200) return { text: "", reading: "" };
  const data = res.json as unknown;
  // Shape: [[["translation","source",...], ..., [null,null,"<target rm>","<source rm>"]], ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) return { text: "", reading: "" };
  const segs = data[0] as unknown[];
  const text = segs
    .map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
    .join("")
    .trim();
  const rm = segs.find((seg) => Array.isArray(seg) && seg[0] == null && typeof seg[3] === "string") as
    | unknown[]
    | undefined;
  const reading = rm && READING_LANGS.has(from) ? String(rm[3]).trim() : "";
  // An untranslatable word comes back unchanged — not a translation.
  return { text: text.toLowerCase() === word.toLowerCase() ? "" : text, reading };
}

/**
 * Kana reading of a Japanese word from Jisho.org's public API (free, no
 * key). Only an entry whose written form is exactly the word counts —
 * Jisho's search is fuzzy and the first hit for 冷蔵 might be 冷蔵庫.
 */
async function jisho(word: string): Promise<{ reading: string; common: boolean }> {
  const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
  const res = await requestUrl({ url, throw: false });
  if (res.status !== 200) return { reading: "", common: false };
  const data = res.json as {
    data?: Array<{ is_common?: boolean; japanese?: Array<{ word?: string; reading?: string }> }>;
  };
  // A kanji word often has several readings (四: し / よん). Take them from
  // the first *common* entry only — Jisho ranks the main sense first — and
  // at most two, so minor and literary readings (一 as ひ / ひい, 四 as よ)
  // and whole other entries (一 as ひとつ) stay out.
  const readings: string[] = [];
  let common = false;
  for (const entry of data.data ?? []) {
    if (entry.is_common !== true) continue;
    const forms = (entry.japanese ?? []).filter(
      (f) => (f.word ?? f.reading) === word && f.reading
    );
    if (forms.length === 0) continue;
    common = true;
    for (const f of forms) if (!readings.includes(f.reading!)) readings.push(f.reading!);
    break;
  }
  if (readings.length === 0) {
    // Nothing marked common: fall back to the first exact match at all.
    for (const entry of data.data ?? []) {
      const form = (entry.japanese ?? []).find((f) => (f.word ?? f.reading) === word && f.reading);
      if (form?.reading) {
        readings.push(form.reading);
        break;
      }
    }
  }
  return { reading: readings.slice(0, 2).join(" / "), common };
}

const jishoReading = async (word: string) => (await jisho(word)).reading;

/** Reading of `word` in its own language: kana for Japanese (romaji as a
 *  fallback), romanisation elsewhere, via a throwaway translation. */
async function readingOf(word: string, lang: string): Promise<string> {
  if (!READING_LANGS.has(lang)) return "";
  if (lang === "ja") {
    // A word already written in kana carries its own reading.
    if (!hasHan(word)) return "";
    const kana = await jishoReading(word).catch(() => "");
    if (kana) return kana;
  }
  const r = await googleTranslate(word, lang, lang === "en" ? "zh-CN" : "en").catch(() => null);
  return r?.reading ?? "";
}

const withReading = (meaning: string, reading: string) =>
  reading && !meaning.includes(reading) ? `${meaning}（${reading}）` : meaning;

/** Digits and punctuation only: nothing any dictionary can translate. */
export const isUntranslatable = (s: string) => /^[\d\s.,:;!?%+\-*/=()'"]+$/.test(s);

async function myMemory(word: string, from: string, to: string): Promise<string> {
  const url =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(word)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
  const res = await requestUrl({ url, throw: false });
  if (res.status !== 200) return "";
  const data = res.json as { responseStatus?: number; responseData?: { translatedText?: string } };
  if (data.responseStatus !== 200) return "";
  const text = (data.responseData?.translatedText || "").trim();
  if (!text || text.toLowerCase() === word.toLowerCase()) return "";
  // MyMemory reports its own errors as 200 with the message in the text.
  if (/^(MYMEMORY WARNING|QUERY LENGTH LIMIT|PLEASE SELECT TWO DISTINCT)/i.test(text)) return "";
  return text;
}

interface WiktionaryEntry {
  partOfSpeech?: string;
  definitions?: Array<{ definition?: string; examples?: string[] }>;
}

async function wiktionary(
  word: string,
  from: string
): Promise<{ definition: string; example: string }> {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  const res = await requestUrl({ url, throw: false });
  if (res.status !== 200) return { definition: "", example: "" };
  const data = res.json as Record<string, WiktionaryEntry[]>;
  // Keyed by language code; "zh-CN" style codes are plain "zh" here.
  const entries = data[from] ?? data[from.split("-")[0]] ?? [];
  let definition = "";
  let example = "";
  for (const entry of entries) {
    for (const d of entry.definitions ?? []) {
      const def = stripHtml(d.definition ?? "");
      if (!definition && def) {
        definition = entry.partOfSpeech ? `${entry.partOfSpeech.toLowerCase()}: ${def}` : def;
      }
      if (!example) {
        const ex = (d.examples ?? []).map((x) => stripRuby(stripHtml(x))).find((x) => x.length > 0);
        if (ex) example = ex;
      }
      if (definition && example) return { definition, example };
    }
  }
  return { definition, example };
}

/**
 * Looks `input` up against the deck language `langName` and returns the
 * foreign word, a meaning in `targetCode`, and an example — any possibly "".
 *
 * Works both ways. Typed in the deck's language ("Wahrscheinlichkeit",
 * Deutsch) → meaning is its translation. Typed in the UI language ("概率",
 * Deutsch) → the word becomes the translation and the meaning is what was
 * typed, so a card can be made from the Chinese side without knowing the
 * foreign word yet. Chinese input is recognised by Han characters; the one
 * ambiguity is a Japanese deck, where kanji-only input is tried as Chinese
 * first and kept as Japanese if the translation comes back unchanged.
 *
 * Throws only when the language name is unknown — a network failure just
 * yields blanks.
 */
export async function lookupWord(
  input: string,
  langName: string,
  targetCode: string
): Promise<LookupResult> {
  const from = langCode(langName);
  if (!from) throw new Error(`unknown language: ${langName}`);
  const typed = input.trim();
  if (!typed) return { word: "", meaning: "", example: "" };

  // Reverse direction: the UI language is Chinese, the input is Chinese
  // (Han, no kana) and the deck is not a Chinese one.
  let reverse =
    targetCode === "zh-CN" && from !== "zh-CN" && hasHan(typed) && !hasKana(typed);
  // Kanji-only input into a Japanese deck could be either language (勉強 is
  // "study" in Japanese, "reluctantly" in Chinese; 吃 is "eat" in Chinese
  // and a rare word for "stutter" in Japanese). Only a *common* Japanese
  // word, per Jisho, is kept as Japanese; anything else is read as Chinese.
  if (reverse && from === "ja") {
    const asJa = await jisho(typed).catch(() => ({ reading: "", common: false }));
    if (asJa.common) reverse = false;
  }
  if (reverse) {
    const translated = await googleTranslate(typed, "zh-CN", from)
      .catch(() => ({ text: "", reading: "" }))
      .then((t) => t.text || myMemory(typed, "zh-CN", from).catch(() => ""));
    if (translated && translated !== typed) {
      const [wikt, reading] = await Promise.all([
        wiktionary(translated, from).catch(() => ({ definition: "", example: "" })),
        readingOf(translated, from),
      ]);
      return { word: translated, meaning: withReading(typed, reading), example: wikt.example };
    }
    if (from !== "ja") return { word: typed, meaning: "", example: "" };
  }

  const w = typed;

  const [g, wikt] = await Promise.all([
    from === targetCode
      ? Promise.resolve({ text: "", reading: "" })
      : googleTranslate(w, from, targetCode).catch(() => ({ text: "", reading: "" })),
    wiktionary(w, from).catch(() => ({ definition: "", example: "" })),
  ]);
  const translated = g.text || (from === targetCode ? "" : await myMemory(w, from, targetCode).catch(() => ""));
  const reading = from === "ja" ? await readingOf(w, from) : g.reading || (await readingOf(w, from));

  // A translation first. None (the word came back unchanged — a kanji word
  // that is the same in Chinese, say) → for Chinese readers the word itself
  // is the meaning, the reading being the useful part; otherwise the
  // dictionary gloss. With an English target the gloss rides along, since
  // it says more than a one-word translation would.
  let meaning = translated;
  if (!meaning) meaning = targetCode === "zh-CN" && hasHan(w) ? w : wikt.definition;
  else if (targetCode === "en" && wikt.definition) meaning = `${translated} — ${wikt.definition}`;

  return { word: w, meaning: withReading(meaning, reading), example: wikt.example };
}

/**
 * The lookup as the UI calls it: picks the target language from the UI
 * language, and turns the two failure modes into a Notice — an unknown
 * language name (fixable in Settings) or simply nothing found.
 */
export async function runLookup(
  ctx: { t: Strings; settings: { lang: Lang } },
  word: string,
  langName: string
): Promise<LookupResult | null> {
  const { t } = ctx;
  const target = ctx.settings.lang === "cn" ? "zh-CN" : "en";
  if (isUntranslatable(word.trim())) {
    new Notice(t.vocabLookupNumber, 5000);
    return null;
  }
  let r: LookupResult;
  try {
    r = await lookupWord(word, langName, target);
  } catch {
    new Notice(t.vocabLookupUnknownLang(langName), 5000);
    return null;
  }
  if (!r.meaning && !r.example) {
    new Notice(t.vocabLookupNone, 4000);
    return null;
  }
  return r;
}
