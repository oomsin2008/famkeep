// Deterministic, rule-based #งาน parser. No LLM.
//
// Grammar (minimal, explicit):
//   #งาน <title>                     -- required; title is the rest of the first line
//   กำหนด: <date/time>               -- optional; Thailand timezone
//   ผู้รับผิดชอบ: <name | ฉัน | ทุกคน>  -- optional; resolved by the caller against members
//
// กำหนด formats supported (Asia/Bangkok, no DST -> fixed +07:00):
//   DD/MM/YYYY HH:mm | DD/MM/YYYY | DD/MM HH:mm | DD/MM
//   วันนี้ [HH:mm] | พรุ่งนี้ [HH:mm] | มะรืน(นี้) [HH:mm]
//   HH:mm                            -- today at that time (or tomorrow if already past)
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

export function parseNganCommand(text: string): NganParseResult {
  if (!text || !text.includes(TRIGGER)) return { ok: false, reason: "no_trigger" };

  const lines = text.split(/\r?\n/);
  const triggerLineIdx = lines.findIndex((l) => l.includes(TRIGGER));
  const firstLine = lines[triggerLineIdx];
  const title = firstLine.slice(firstLine.indexOf(TRIGGER) + TRIGGER.length).trim();

  if (!title) return { ok: false, reason: "missing_title" };

  let dueRaw: string | null = null;
  let assigneeRaw: string | null = null;

  for (const line of lines.slice(triggerLineIdx + 1)) {
    const due = matchField(line, ["กำหนด", "กําหนด", "due"]);
    if (due !== null && dueRaw === null) dueRaw = due;
    const who = matchField(line, ["ผู้รับผิดชอบ", "ผู้รับ", "มอบหมาย", "assignee"]);
    if (who !== null && assigneeRaw === null) assigneeRaw = who;
  }

  return { ok: true, title: title.slice(0, 200), dueRaw, assigneeRaw };
}

function matchField(line: string, keys: string[]): string | null {
  const trimmed = line.trim();
  for (const key of keys) {
    if (trimmed.startsWith(key)) {
      const rest = trimmed.slice(key.length).replace(/^[:：\s]+/, "").trim();
      return rest.length > 0 ? rest : null;
    }
  }
  return null;
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

/**
 * Parse a `กำหนด:` value to a UTC ISO instant. `error:true` means the value was
 * present but unparseable (caller should send a usage hint rather than guess).
 */
export function parseThaiDue(raw: string | null, now: Date): DueParseResult {
  if (raw === null) return { iso: null, error: false };
  const s = raw.trim().toLowerCase();
  const cur = bkkNow(now);

  const timeMatch = s.match(/(\d{1,2})[:.](\d{2})/);
  const hh = timeMatch ? clamp(parseInt(timeMatch[1], 10), 0, 23) : 9;
  const mm = timeMatch ? clamp(parseInt(timeMatch[2], 10), 0, 59) : 0;
  const hasTime = Boolean(timeMatch);

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
