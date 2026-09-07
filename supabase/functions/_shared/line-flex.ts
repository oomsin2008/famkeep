// LINE Flex Message builders for FamKeep bot confirmations (A2 + B2).
// Colors mirror the app design tokens (docs/design). Every builder returns a
// LineFlexMessage whose altText is the lock-screen notification text and the
// fallback for clients that cannot render Flex. When `link` is null (no
// APP_PUBLIC_URL) the bubble is still valid, just without its button.
import type { LineFlexMessage } from "./line.ts";
import type { FileKind } from "./drive.ts";

export type FlexContext = "private" | "family";

const T = {
  private: { tint: "#E7F1F8", ink: "#4C79A4", solid: "#5883B4" },
  family: { tint: "#FBEFE6", ink: "#B25B2A", solid: "#BF6A35" },
  progress: { tint: "#DEE9FC", ink: "#1D4ED8" },
  overdue: { tint: "#FBE0E0", ink: "#B91C1C" },
  duesoon: { tint: "#FBEECB", ink: "#A9640A" },
  done: { tint: "#DBF3E1", ink: "#1B6A3B" },
  meta: "#8A8A8F",
  ink: "#1B1B1D",
} as const;

const KIND_ICON: Record<FileKind, string> = {
  image: "🖼️",
  pdf: "📄",
  doc: "📄",
  other: "📎",
};
const KIND_LABEL: Record<FileKind, string> = {
  image: "รูปภาพ",
  pdf: "เอกสาร",
  doc: "เอกสาร",
  other: "ไฟล์",
};

const IMAGE_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "tif",
  "tiff",
]);
const DOC_EXT = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "rtf",
  "odt",
  "ods",
  "odp",
]);

/** Best-effort FileKind from a filename's extension (for paths where we only
 *  have the name, e.g. rename). */
function kindFromName(name: string): FileKind {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (DOC_EXT.has(ext)) return "doc";
  return "other";
}

const BKK = "Asia/Bangkok";

function fmtSize(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** "วันนี้ 15:08" on the same Bangkok day, else "6 ก.ย. 15:08". */
function fmtWhen(tsMs?: number): string {
  const d = tsMs ? new Date(tsMs) : new Date();
  const time = new Intl.DateTimeFormat("th-TH", {
    timeZone: BKK,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  const dayKey = (x: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BKK,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(x);
  if (dayKey(d) === dayKey(new Date())) return `วันนี้ ${time}`;
  const date = new Intl.DateTimeFormat("th-TH", {
    timeZone: BKK,
    day: "numeric",
    month: "short",
  }).format(d);
  return `${date} ${time}`;
}

// ---- low-level bubble parts ------------------------------------------------

type Box = Record<string, unknown>;

function text(t: string, opts: Box = {}): Box {
  return { type: "text", text: t, wrap: true, ...opts };
}

function header(label: string, tone: { tint: string; ink: string }): Box {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: tone.tint,
    paddingAll: "12px",
    paddingBottom: "10px",
    contents: [text(label, { weight: "bold", size: "sm", color: tone.ink })],
  };
}

function fileLine(icon: string, name: string): Box {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      text(icon, { flex: 0, size: "sm" }),
      text(name, { weight: "bold", size: "sm", flex: 5, color: T.ink }),
    ],
  };
}

function kv(k: string, v: string): Box {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      text(k, { color: T.meta, size: "xs", flex: 2 }),
      text(v, { size: "sm", flex: 5, color: T.ink }),
    ],
  };
}

function pill(label: string, tone: { tint: string; ink: string }): Box {
  return {
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 0,
        backgroundColor: tone.tint,
        cornerRadius: "999px",
        paddingTop: "3px",
        paddingBottom: "3px",
        paddingStart: "12px",
        paddingEnd: "12px",
        contents: [text(label, { size: "xs", weight: "bold", color: tone.ink })],
      },
      { type: "filler" },
    ],
  };
}

function linkFooter(
  label: string,
  uri: string | null,
  color: string,
): Box | null {
  if (!uri) return null;
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "10px",
    contents: [
      {
        type: "button",
        style: "primary",
        color,
        height: "sm",
        action: { type: "uri", label, uri },
      },
    ],
  };
}

function bubble(parts: { header?: Box; body: Box; footer?: Box | null }): Box {
  const b: Box = { type: "bubble", size: "kilo", body: parts.body };
  if (parts.header) b.header = parts.header;
  if (parts.footer) b.footer = parts.footer;
  return b;
}

function flex(altText: string, contents: Box): LineFlexMessage {
  return { type: "flex", altText: altText.slice(0, 390), contents };
}

function body(contents: Box[]): Box {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "14px",
    contents,
  };
}

// ---- builders ------------------------------------------------------------

export function savedFileFlex(o: {
  kind: FileKind;
  name: string;
  sizeBytes?: number;
  tsMs?: number;
  context: FlexContext;
  link: string | null;
}): LineFlexMessage {
  const tone = T[o.context];
  const head = o.context === "private"
    ? "เก็บเข้าคลังของฉันแล้ว"
    : "เก็บเข้าคลังครอบครัวแล้ว";
  const meta = [KIND_LABEL[o.kind], fmtSize(o.sizeBytes ?? 0), fmtWhen(o.tsMs)]
    .filter(Boolean)
    .join(" · ");
  const note = o.context === "private"
    ? "เปลี่ยนชื่อไฟล์ พิมพ์  #ชื่อไฟล์  ตามด้วยชื่อใหม่"
    : "ทุกคนในครอบครัวเปิดดูไฟล์นี้ได้";
  return flex(
    `${head} — ${o.name}`,
    bubble({
      header: header(head, tone),
      body: body([
        fileLine(KIND_ICON[o.kind], o.name),
        text(meta, { size: "xs", color: T.meta }),
        { type: "separator", margin: "md" },
        text(note, { size: "xs", color: T.meta, margin: "md" }),
      ]),
      footer: linkFooter("เปิดในล็อคเกอร์", o.link, tone.solid),
    }),
  );
}

export function duplicateFileFlex(link: string | null): LineFlexMessage {
  return flex(
    "ไฟล์นี้เก็บไว้ในคลังแล้ว",
    bubble({
      body: body([text("ไฟล์นี้เก็บไว้ในคลังแล้ว", { size: "sm", color: T.ink })]),
      footer: linkFooter("เปิดในล็อคเกอร์", link, T.private.solid),
    }),
  );
}

export function renamedFileFlex(
  name: string,
  link: string | null,
): LineFlexMessage {
  return flex(
    `เปลี่ยนชื่อไฟล์เป็น ${name} แล้ว`,
    bubble({
      header: header("เปลี่ยนชื่อไฟล์แล้ว", T.done),
      body: body([fileLine(KIND_ICON[kindFromName(name)], name)]),
      footer: linkFooter("เปิดในล็อคเกอร์", link, T.done.ink),
    }),
  );
}

export function taskCreatedFlex(o: {
  title: string;
  dueLabel: string;
  assigneeName?: string | null;
  context: FlexContext;
  link: string | null;
}): LineFlexMessage {
  const rows: Box[] = [
    text(o.title, { weight: "bold", size: "md", color: T.ink }),
    kv("กำหนด", o.dueLabel),
  ];
  if (o.context === "family" && o.assigneeName) {
    rows.push(kv("ผู้รับผิดชอบ", o.assigneeName));
  }
  rows.push(pill(o.context === "private" ? "ของฉัน" : "ครอบครัว", T[o.context]));
  return flex(
    `เพิ่มงาน ${o.title} · กำหนด ${o.dueLabel}`,
    bubble({
      header: header("เพิ่มงานใหม่แล้ว", T.progress),
      body: body(rows),
      footer: linkFooter("เปิดงานนี้", o.link, T.progress.ink),
    }),
  );
}

export function reminderFlex(o: {
  title: string;
  dueLabel: string | null;
  headLabel: string;
  tone: "overdue" | "duesoon";
  link: string | null;
}): LineFlexMessage {
  const tone = T[o.tone];
  const rows: Box[] = [
    text(o.title, { weight: "bold", size: "md", color: T.ink }),
  ];
  if (o.dueLabel) rows.push(kv("กำหนด", o.dueLabel));
  return flex(
    `เตือนงาน: ${o.title} — ${o.headLabel}${
      o.dueLabel ? ` (${o.dueLabel})` : ""
    }`,
    bubble({
      header: header(o.headLabel, tone),
      body: body(rows),
      footer: linkFooter("เปิดงานนี้", o.link, tone.ink),
    }),
  );
}
