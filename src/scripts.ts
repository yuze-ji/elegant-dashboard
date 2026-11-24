/**
 * Writing-system reference data for the Language page: Japanese kana and
 * the Korean alphabet, as rows of (character, reading). Static — the only
 * state is the per-character drill record in settings.scriptLog.
 */

export type ScriptId = "hiragana" | "katakana" | "hangul" | "hangulSyllables";

export interface ScriptChar {
  ch: string;
  /** Romanised reading; for kana also the twin in the other script. */
  read: string;
  twin?: string;
}

export interface ScriptSection {
  /** Label key into Strings.scriptSections. */
  key: string;
  /** Rows of the chart; a null cell is a gap in the grid. */
  rows: Array<Array<ScriptChar | null>>;
}

// ---- kana: built from one romaji table, so the two scripts stay in step.

const KANA_READS: string[][] = [
  ["a", "i", "u", "e", "o"],
  ["ka", "ki", "ku", "ke", "ko"],
  ["sa", "shi", "su", "se", "so"],
  ["ta", "chi", "tsu", "te", "to"],
  ["na", "ni", "nu", "ne", "no"],
  ["ha", "hi", "fu", "he", "ho"],
  ["ma", "mi", "mu", "me", "mo"],
  ["ya", "", "yu", "", "yo"],
  ["ra", "ri", "ru", "re", "ro"],
  ["wa", "", "", "", "wo"],
  ["n", "", "", "", ""],
];
const HIRA_BASE = [
  "あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの",
  "はひふへほ", "まみむめも", "や ゆ よ", "らりるれろ", "わ   を", "ん    ",
];
const KATA_BASE = [
  "アイウエオ", "カキクケコ", "サシスセソ", "タチツテト", "ナニヌネノ",
  "ハヒフヘホ", "マミムメモ", "ヤ ユ ヨ", "ラリルレロ", "ワ   ヲ", "ン    ",
];
const DAKU_READS: string[][] = [
  ["ga", "gi", "gu", "ge", "go"],
  ["za", "ji", "zu", "ze", "zo"],
  ["da", "ji", "zu", "de", "do"],
  ["ba", "bi", "bu", "be", "bo"],
  ["pa", "pi", "pu", "pe", "po"],
];
const HIRA_DAKU = ["がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ"];
const KATA_DAKU = ["ガギグゲゴ", "ザジズゼゾ", "ダヂヅデド", "バビブベボ", "パピプペポ"];
const YOON_READS: string[][] = [
  ["kya", "kyu", "kyo"], ["sha", "shu", "sho"], ["cha", "chu", "cho"],
  ["nya", "nyu", "nyo"], ["hya", "hyu", "hyo"], ["mya", "myu", "myo"],
  ["rya", "ryu", "ryo"], ["gya", "gyu", "gyo"], ["ja", "ju", "jo"],
  ["bya", "byu", "byo"], ["pya", "pyu", "pyo"],
];
const HIRA_YOON = ["きゃきゅきょ", "しゃしゅしょ", "ちゃちゅちょ", "にゃにゅにょ", "ひゃひゅひょ", "みゃみゅみょ", "りゃりゅりょ", "ぎゃぎゅぎょ", "じゃじゅじょ", "びゃびゅびょ", "ぴゃぴゅぴょ"];
const KATA_YOON = ["キャキュキョ", "シャシュショ", "チャチュチョ", "ニャニュニョ", "ヒャヒュヒョ", "ミャミュミョ", "リャリュリョ", "ギャギュギョ", "ジャジュジョ", "ビャビュビョ", "ピャピュピョ"];

function kanaRows(
  mine: string[],
  twin: string[],
  reads: string[][],
  width: number
): Array<Array<ScriptChar | null>> {
  return mine.map((row, r) => {
    const cells: Array<ScriptChar | null> = [];
    const chars = [...row];
    const twins = [...twin[r]];
    for (let i = 0; i < reads[r].length; i++) {
      const read = reads[r][i];
      const ch = chars.slice(i * width, i * width + width).join("").trim();
      const tw = twins.slice(i * width, i * width + width).join("").trim();
      cells.push(read && ch ? { ch, read, twin: tw } : null);
    }
    return cells;
  });
}

function kanaScript(mine: [string[], string[], string[]], twin: [string[], string[], string[]]): ScriptSection[] {
  return [
    { key: "gojuon", rows: kanaRows(mine[0], twin[0], KANA_READS, 1) },
    { key: "dakuten", rows: kanaRows(mine[1], twin[1], DAKU_READS, 1) },
    { key: "yoon", rows: kanaRows(mine[2], twin[2], YOON_READS, 2) },
  ];
}

// ---- hangul

const row = (pairs: Array<[string, string]>): Array<ScriptChar | null> =>
  pairs.map(([ch, read]) => ({ ch, read }));

const HANGUL: ScriptSection[] = [
  {
    key: "consonants",
    rows: [
      row([["ㄱ", "g/k"], ["ㄴ", "n"], ["ㄷ", "d/t"], ["ㄹ", "r/l"], ["ㅁ", "m"], ["ㅂ", "b/p"], ["ㅅ", "s"]]),
      row([["ㅇ", "ng / -"], ["ㅈ", "j"], ["ㅊ", "ch"], ["ㅋ", "k"], ["ㅌ", "t"], ["ㅍ", "p"], ["ㅎ", "h"]]),
    ],
  },
  {
    key: "doubleConsonants",
    rows: [row([["ㄲ", "kk"], ["ㄸ", "tt"], ["ㅃ", "pp"], ["ㅆ", "ss"], ["ㅉ", "jj"]])],
  },
  {
    key: "vowels",
    rows: [
      row([["ㅏ", "a"], ["ㅑ", "ya"], ["ㅓ", "eo"], ["ㅕ", "yeo"], ["ㅗ", "o"]]),
      row([["ㅛ", "yo"], ["ㅜ", "u"], ["ㅠ", "yu"], ["ㅡ", "eu"], ["ㅣ", "i"]]),
    ],
  },
  {
    key: "compoundVowels",
    rows: [
      row([["ㅐ", "ae"], ["ㅒ", "yae"], ["ㅔ", "e"], ["ㅖ", "ye"], ["ㅘ", "wa"], ["ㅙ", "wae"]]),
      row([["ㅚ", "oe"], ["ㅝ", "wo"], ["ㅞ", "we"], ["ㅟ", "wi"], ["ㅢ", "ui"]]),
    ],
  },
];

// ---- hangul syllables: every basic consonant with every basic vowel.
// Composed by Unicode arithmetic (U+AC00 + (initial × 21 + vowel) × 28),
// which is how the syllable blocks are laid out in the first place.

const INITIALS: Array<[string, string, number]> = [
  // jamo, romanisation as an initial, index in the Unicode initial table
  ["ㄱ", "g", 0], ["ㄴ", "n", 2], ["ㄷ", "d", 3], ["ㄹ", "r", 5], ["ㅁ", "m", 6],
  ["ㅂ", "b", 7], ["ㅅ", "s", 9], ["ㅇ", "", 11], ["ㅈ", "j", 12], ["ㅊ", "ch", 14],
  ["ㅋ", "k", 15], ["ㅌ", "t", 16], ["ㅍ", "p", 17], ["ㅎ", "h", 18],
];
const MEDIALS: Array<[string, string, number]> = [
  ["ㅏ", "a", 0], ["ㅑ", "ya", 2], ["ㅓ", "eo", 4], ["ㅕ", "yeo", 6], ["ㅗ", "o", 8],
  ["ㅛ", "yo", 12], ["ㅜ", "u", 13], ["ㅠ", "yu", 17], ["ㅡ", "eu", 18], ["ㅣ", "i", 20],
];

const HANGUL_SYLLABLES: ScriptSection[] = [
  {
    key: "syllables",
    rows: INITIALS.map(([jamo, cRead, ci]) =>
      MEDIALS.map(([v, vRead, vi]) => ({
        ch: String.fromCharCode(0xac00 + (ci * 21 + vi) * 28),
        read: cRead + vRead,
        twin: `${jamo}+${v}`,
      }))
    ),
  },
];

export const SCRIPTS: Record<ScriptId, ScriptSection[]> = {
  hiragana: kanaScript([HIRA_BASE, HIRA_DAKU, HIRA_YOON], [KATA_BASE, KATA_DAKU, KATA_YOON]),
  katakana: kanaScript([KATA_BASE, KATA_DAKU, KATA_YOON], [HIRA_BASE, HIRA_DAKU, HIRA_YOON]),
  hangul: HANGUL,
  hangulSyllables: HANGUL_SYLLABLES,
};

export const SCRIPT_IDS: ScriptId[] = ["hiragana", "katakana", "hangul", "hangulSyllables"];

/** Scripts that make sense drilled together, per tab. */
export const MIXED_WITH: Record<ScriptId, ScriptId[]> = {
  hiragana: ["hiragana", "katakana"],
  katakana: ["hiragana", "katakana"],
  hangul: ["hangul", "hangulSyllables"],
  hangulSyllables: ["hangul", "hangulSyllables"],
};

export function allChars(script: ScriptId): ScriptChar[] {
  const out: ScriptChar[] = [];
  for (const s of SCRIPTS[script]) for (const r of s.rows) for (const c of r) if (c) out.push(c);
  return out;
}
