// Deterministic, rule-based #งาน parser. No LLM.
//
// The user types "#งาน" and may dictate the rest (Android/Gboard voice): one
// line, no ":", no newlines, numbers often spelled as Thai words. Both the
// spoken form and the original typed multi-line form are accepted.
//
//   #งาน <title> [กำหนด <date/time>] [ผู้รับผิดชอบ <name | ฉัน | ทุกคน>]
//
// กำหนด formats (Asia/Bangkok, no DST -> fixed +07:00):
//   DD/MM/YYYY HH:mm | DD/MM/YYYY | DD/MM HH:mm | DD/MM
//   วันนี้ / พรุ่งนี้ / มะรืน(นี้)  [+ any time below]
//   HH:mm | H นาฬิกา [MM] | H นาฬิกาครึ่ง | H[:MM] AM/PM
//   บ่าย N [โมง] | N โมงเย็น | เย็น N | N ทุ่ม | ตี N | N โมงเช้า | เช้า N
//   เที่ยง | เที่ยงคืน   (+ "ครึ่ง" suffix anywhere -> :30)
//   a bare time already past today -> tomorrow; no time -> 09:00
// 4-digit years >= 2400 are treated as Buddhist Era and converted.

const TRIGGER = "#งาน";
const BKK_OFFSET_MIN = 7 * 60;

export interface NganParseOk {
  ok: true;
  title: string;
  dueRaw: string | null;
  assigneeRaw: string | null;
}
export interface NganParseErr {
  ok: false;
  reason: "no_trigger" | "missing_title";
}
export type NganParseResult = NganParseOk | NganParseErr;

const DUE_KEYS = ["กำหนด", "กําหนด", "วันที่", "due"];
const ASSIGNEE_KEYS = [
  "ผู้รับผิดชอบ",
  "ผู้รับ",
  "มอบหมายให้",
  "มอบหมาย",
  "assignee",
];

/** Collapse runs of whitespace (incl. newlines) to a single space and trim. */
function tidy(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** First index in `body` where any keyword begins with non-space content before
 *  it (so a leading "กำหนดการประชุม" stays part of the title). -1 if none. */
function firstKeyword(body: string, keys: string[]): number {
  let best = -1;
  for (const key of keys) {
    let from = 0;
    while (true) {
      const at = body.indexOf(key, from);
      if (at < 0) break;
      if (body.slice(0, at).trim().length > 0 && (best < 0 || at < best)) {
        best = at;
      }
      from = at + key.length;
    }
  }
  return best;
}

/** Strip a leading keyword + ":" from a field segment. */
function stripKey(segment: string, keys: string[]): string {
  const s = segment.trimStart();
  for (const key of keys) {
    if (s.startsWith(key)) {
      return s.slice(key.length).replace(/^[:：\s]+/, "");
    }
  }
  return s;
}

export function parseNganCommand(text: string): NganParseResult {
  if (!text || !text.includes(TRIGGER)) return { ok: false, reason: "no_trigger" };

  const body = text.slice(text.indexOf(TRIGGER) + TRIGGER.length);

  const dueAt = firstKeyword(body, DUE_KEYS);
  const whoAt = firstKeyword(body, ASSIGNEE_KEYS);

  const cuts = [dueAt, whoAt].filter((i) => i >= 0).sort((a, b) => a - b);
  const titleEnd = cuts.length > 0 ? cuts[0] : body.length;
  const title = tidy(body.slice(0, titleEnd));
  if (!title) return { ok: false, reason: "missing_title" };

  const fieldValue = (start: number, keys: string[]): string | null => {
    if (start < 0) return null;
    const next = cuts.find((i) => i > start);
    const raw = stripKey(body.slice(start, next ?? body.length), keys);
    const val = tidy(raw);
    return val.length > 0 ? val : null;
  };

  return {
    ok: true,
    title: title.slice(0, 200),
    dueRaw: fieldValue(dueAt, DUE_KEYS),
    assigneeRaw: fieldValue(whoAt, ASSIGNEE_KEYS),
  };
}

/** Build a UTC ISO string from Bangkok wall-clock components. */
function bkkToUtcIso(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): string {
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - BKK_OFFSET_MIN * 60_000)
    .toISOString();
}

/** `now` in Bangkok wall-clock. */
function bkkNow(now: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const shifted = new Date(now.getTime() + BKK_OFFSET_MIN * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
  };
}

function normYear(y: number): number {
  if (y >= 2400) return y - 543; // Buddhist Era
  if (y < 100) return 2000 + y;
  return y;
}

export interface DueParseResult {
  iso: string | null;
  error: boolean;
}

const THAI_NUM: Record<string, number> = {
  หนึ่ง: 1,
  เอ็ด: 1,
  นึง: 1,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
  สิบ: 10,
  สิบเอ็ด: 11,
  สิบเอด: 11,
};

// A number token: 1-2 Arabic digits or a spelled-out Thai number. Longer Thai
// words first so "สิบเอ็ด" wins over "สิบ".
const NUM = `(\\d{1,2}|${
  Object.keys(THAI_NUM).sort((a, b) => b.length - a.length).join("|")
})`;

function toNum(tok: string | undefined): number | null {
  if (!tok) return null;
  if (/^\d{1,2}$/.test(tok)) return parseInt(tok, 10);
  return THAI_NUM[tok] ?? null;
}

/**
 * Parse a time-of-day phrase to 24h {hh, mm}, or null. `s` must be lowercased.
 * Handles HH:mm, "H นาฬิกา MM", AM/PM, and Thai บ่าย/เย็น/ทุ่ม/ตี/เที่ยง forms
 * with an optional "ครึ่ง" (:30) and Thai-word numbers.
 */
export function parseTimeOfDay(s: string): { hh: number; mm: number } | null {
  const t = s.replace(
    /[๐-๙]/g,
    (d) => "๐๑๒๓๔๕๖๗๘๙".indexOf(d).toString(),
  );
  const half = /ครึ่ง/.test(t);
  const at = (hh: number, mm = 0): { hh: number; mm: number } | null =>
    hh >= 0 && hh <= 23
      ? { hh, mm: mm || (half ? 30 : 0) }
      : null;

  if (/เที่ยงคืน/.test(t)) return at(0);
  if (/เที่ยง/.test(t)) return at(12);

  let m = t.match(/(\d{1,2})(?:[:.](\d{1,2}))?\s*([ap])\.?\s*m\.?/);
  if (m) {
    const hh = (parseInt(m[1], 10) % 12) + (m[3] === "p" ? 12 : 0);
    return at(hh, m[2] ? parseInt(m[2], 10) : 0);
  }

  m = t.match(/(\d{1,2})\s*นาฬิกา\s*(\d{1,2})?/);
  if (m) return at(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0);

  m = t.match(new RegExp(`ตี\\s*${NUM}`));
  if (m) return at(toNum(m[1]) ?? -1);

  if (/บ่ายโมง/.test(t)) return at(13);
  m = t.match(new RegExp(`บ่าย\\s*${NUM}`));
  if (m) {
    const n = toNum(m[1]);
    return n === null ? null : at(12 + n);
  }

  m = t.match(new RegExp(`(?:${NUM}\\s*โมงเย็น|เย็น\\s*${NUM})`));
  if (m) {
    const n = toNum(m[1] ?? m[2]);
    return n === null ? null : at(12 + n);
  }

  if (/ทุ่มนึง|ทุ่มหนึ่ง/.test(t)) return at(19);
  m = t.match(new RegExp(`${NUM}\\s*ทุ่ม`));
  if (m) {
    const n = toNum(m[1]);
    return n === null ? null : at(18 + n);
  }
  if (/ทุ่ม/.test(t)) return at(19);

  m = t.match(new RegExp(`(?:${NUM}\\s*โมงเช้า|เช้า\\s*${NUM})`));
  if (m) {
    const n = toNum(m[1] ?? m[2]);
    return n === null ? null : at(n);
  }

  m = t.match(/(\d{1,2})[:.](\d{2})/);
  if (m) {
    return {
      hh: clamp(parseInt(m[1], 10), 0, 23),
      mm: clamp(parseInt(m[2], 10), 0, 59),
    };
  }

  return null;
}

/**
 * Parse a `กำหนด:` value to a UTC ISO instant. `error:true` means the value was
 * present but unparseable (caller should send a usage hint rather than guess).
 */
export function parseThaiDue(raw: string | null, now: Date): DueParseResult {
  if (raw === null) return { iso: null, error: false };
  const s = raw.trim().toLowerCase();
  const cur = bkkNow(now);

  const tod = parseTimeOfDay(s);
  const hh = tod ? tod.hh : 9;
  const mm = tod ? tod.mm : 0;
  const hasTime = tod !== null;

  // relative day words
  const rel = s.startsWith("วันนี้")
    ? 0
    : s.startsWith("พรุ่งนี้") || s.startsWith("พรุ่ง")
      ? 1
      : s.startsWith("มะรืน")
        ? 2
        : null;
  if (rel !== null) {
    const base = new Date(Date.UTC(cur.y, cur.mo - 1, cur.d + rel, hh, mm));
    return {
      iso: bkkToUtcIso(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate(),
        hh,
        mm,
      ),
      error: false,
    };
  }

  // DD/MM[/YYYY]
  const dmy = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dmy) {
    const d = clamp(parseInt(dmy[1], 10), 1, 31);
    const mo = clamp(parseInt(dmy[2], 10), 1, 12);
    const y = dmy[3] ? normYear(parseInt(dmy[3], 10)) : cur.y;
    return { iso: bkkToUtcIso(y, mo, d, hh, mm), error: false };
  }

  // bare HH:mm -> today, or tomorrow if already past
  if (hasTime) {
    let day = cur.d;
    if (hh < cur.h || (hh === cur.h && mm <= cur.mi)) day += 1;
    const base = new Date(Date.UTC(cur.y, cur.mo - 1, day, hh, mm));
    return {
      iso: bkkToUtcIso(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate(),
        hh,
        mm,
      ),
      error: false,
    };
  }

  return { iso: null, error: true };
}

/** Default due when `กำหนด:` is omitted: tomorrow 09:00 Asia/Bangkok. */
export function defaultDueIso(now: Date): string {
  const cur = bkkNow(now);
  const base = new Date(Date.UTC(cur.y, cur.mo - 1, cur.d + 1, 9, 0));
  return bkkToUtcIso(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    9,
    0,
  );
}

const SELF_WORDS = ["ฉัน", "ตัวเอง", "ผม", "หนู", "self", "me"];
const ALL_WORDS = ["ทุกคน", "all", "everyone"];

export type AssigneeIntent =
  | { kind: "self" }
  | { kind: "all" }
  | { kind: "name"; value: string }
  | { kind: "none" };

export function classifyAssignee(raw: string | null): AssigneeIntent {
  if (raw === null) return { kind: "none" };
  const s = raw.trim().toLowerCase();
  if (!s) return { kind: "none" };
  if (SELF_WORDS.includes(s)) return { kind: "self" };
  if (ALL_WORDS.includes(s)) return { kind: "all" };
  return { kind: "name", value: raw.trim() };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);
}
