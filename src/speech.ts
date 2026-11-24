/**
 * Read a word or character aloud with the system's text-to-speech (Web
 * Speech API — present in Electron and on mobile). No network, no bundled
 * audio: the voice is whatever the OS ships for that language, so Japanese
 * and Korean need their language pack installed (macOS and iOS have them).
 */

import type { ScriptId } from "./scripts";

/** Vocabulary language label → BCP-47 tag. Unknown labels fall back on a
 *  script sniff, then on the UI default. */
const LANG_TAGS: Record<string, string> = {
  日本語: "ja-JP", 日语: "ja-JP", japanese: "ja-JP",
  한국어: "ko-KR", 韩语: "ko-KR", korean: "ko-KR",
  deutsch: "de-DE", german: "de-DE", 德语: "de-DE",
  english: "en-US", 英语: "en-US",
  français: "fr-FR", french: "fr-FR", 法语: "fr-FR",
  español: "es-ES", spanish: "es-ES", 西班牙语: "es-ES",
  中文: "zh-CN", chinese: "zh-CN", 汉语: "zh-CN",
};

export const SCRIPT_LANG: Record<ScriptId, string> = {
  hiragana: "ja-JP",
  katakana: "ja-JP",
  hangul: "ko-KR",
  hangulSyllables: "ko-KR",
};

export function langTag(label: string, sample = ""): string {
  const hit = LANG_TAGS[label] ?? LANG_TAGS[label.trim().toLowerCase()];
  if (hit) return hit;
  if (/[぀-ヿ]/.test(sample)) return "ja-JP";
  if (/[가-힯㄰-㆏]/.test(sample)) return "ko-KR";
  if (/[一-鿿]/.test(sample)) return "zh-CN";
  return "en-US";
}

/** "八（はち / や）" → "はち": a kana reading in the meaning beats the kanji,
 *  which a Japanese voice may read with the wrong on/kun reading. Returns
 *  null when the meaning holds no kana. */
export function kanaReading(meaning: string): string | null {
  const m = meaning.match(/[（(]\s*([぀-ヿー]+)/);
  return m ? m[1] : null;
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let voices: SpeechSynthesisVoice[] = [];
let primed = false;
function primeVoices() {
  if (primed || !speechAvailable()) return;
  primed = true;
  voices = speechSynthesis.getVoices();
  speechSynthesis.addEventListener("voiceschanged", () => (voices = speechSynthesis.getVoices()));
}

function pickVoice(tag: string): SpeechSynthesisVoice | null {
  primeVoices();
  const base = tag.split("-")[0].toLowerCase();
  const same = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
  if (!same.length) return null;
  // macOS lists novelty voices (Eddy, Grandpa, …) alongside the real ones;
  // their names carry the language in brackets, the proper voices don't.
  const plain = same.filter((v) => !/[（(]/.test(v.name));
  const pool = plain.length ? plain : same;
  return pool.find((v) => v.lang.replace("_", "-") === tag && v.localService) ?? pool.find((v) => v.localService) ?? pool[0];
}

/** Speak `text` in `tag`; a slightly slower rate keeps single kana clear.
 *  Cuts off whatever was still playing. */
export function speak(text: string, tag: string, rate = 0.85): void {
  if (!speechAvailable() || !text.trim()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag;
  u.rate = rate;
  const voice = pickVoice(tag);
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

/** Small speaker button; stops the click from reaching the parent card. */
export function speakButton(parent: HTMLElement, title: string, onSpeak: () => void): HTMLButtonElement {
  const b = parent.createEl("button", { cls: "ed-speak-btn", text: "🔊" });
  b.setAttr("aria-label", title);
  b.setAttr("title", title);
  b.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onSpeak();
  };
  return b;
}
