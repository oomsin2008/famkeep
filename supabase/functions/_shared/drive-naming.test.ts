import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  deletedName,
  mimeToExt,
  safeFilename,
  sanitizeName,
  synthName,
} from "./drive.ts";

// 2026-09-03 14:41:35 Asia/Bangkok  ==  2026-09-03 07:41:35 UTC
const TS = Date.parse("2026-09-03T07:41:35Z");

Deno.test("synthName: Thai kind + Bangkok stamp + mime extension", () => {
  assertEquals(synthName("image/jpeg", TS), "รูปภาพ-20260903-144135.jpg");
  assertEquals(synthName("application/pdf", TS), "เอกสาร-20260903-144135.pdf");
  assertEquals(
    synthName("application/octet-stream", TS),
    "ไฟล์-20260903-144135.bin",
  );
  assertEquals(
    synthName(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      TS,
    ),
    "เอกสาร-20260903-144135.docx",
  );
});

Deno.test("synthName: uses Bangkok wall-clock, not UTC", () => {
  // 23:30 UTC on the 3rd is 06:30 on the 4th in Bangkok
  const ts = Date.parse("2026-09-03T23:30:00Z");
  assertEquals(synthName("image/png", ts), "รูปภาพ-20260904-063000.png");
});

Deno.test("safeFilename: preserves a real name, lowercases extension", () => {
  assertEquals(safeFilename("Q3 Report.PDF", "application/pdf"), "Q3 Report.pdf");
  assertEquals(
    safeFilename("งบครอบครัว 2569.xlsx", "application/vnd.ms-excel"),
    "งบครอบครัว 2569.xlsx",
  );
});

Deno.test("safeFilename: strips path separators", () => {
  assertEquals(safeFilename("../../etc/passwd", "text/plain"), "passwd.txt");
  assertEquals(
    safeFilename("C:\\Users\\me\\scan.jpg", "image/jpeg"),
    "scan.jpg",
  );
});

Deno.test("safeFilename: adds a MIME extension when the name has none", () => {
  assertEquals(safeFilename("receipt", "image/png"), "receipt.png");
  assertEquals(safeFilename("data.", "application/pdf"), "data..pdf");
});

Deno.test("safeFilename: neutralizes hostile characters", () => {
  assertEquals(
    safeFilename('a<b>c:"d"|e?f*g.jpg', "image/jpeg"),
    "a_b_c_d_e_f_g.jpg",
  );
});

Deno.test("safeFilename: caps overly long names, keeps extension", () => {
  const out = safeFilename("x".repeat(400) + ".pdf", "application/pdf");
  assertEquals(out.length <= 150, true);
  assertMatch(out, /\.pdf$/);
});

Deno.test("safeFilename: degenerate input falls back to synthName", () => {
  assertEquals(safeFilename("   ", "image/jpeg", TS), "รูปภาพ-20260903-144135.jpg");
  assertEquals(safeFilename("", "application/pdf", TS), "เอกสาร-20260903-144135.pdf");
  assertEquals(safeFilename(null, "application/pdf", TS), "เอกสาร-20260903-144135.pdf");
  assertEquals(safeFilename("..", "application/pdf", TS), "เอกสาร-20260903-144135.pdf");
});

Deno.test("deletedName: DELETED-<bkk stamp>-<original>, name preserved", () => {
  assertEquals(
    deletedName("test print.pdf", TS),
    "DELETED-20260903-144135-test print.pdf",
  );
  assertEquals(
    deletedName("รูปภาพ-20260903-073442.jpg", TS),
    "DELETED-20260903-144135-รูปภาพ-20260903-073442.jpg",
  );
});

Deno.test("deletedName: sanitizes path + hostile chars, keeps spaces/Thai", () => {
  assertEquals(
    deletedName("../../secret/รายงาน ปี.xlsx", TS),
    "DELETED-20260903-144135-รายงาน ปี.xlsx",
  );
  assertEquals(
    deletedName('a:b|c?.png', TS),
    "DELETED-20260903-144135-a_b_c_.png",
  );
});

Deno.test("sanitizeName: caps length, never empty", () => {
  assertEquals(sanitizeName("x".repeat(500)).length <= 180, true);
  assertEquals(sanitizeName("///"), "file");
  assertEquals(sanitizeName(""), "file");
});

Deno.test("mimeToExt: known and unknown", () => {
  assertEquals(mimeToExt("image/webp"), "webp");
  assertEquals(mimeToExt("application/pdf; charset=binary"), "pdf");
  assertEquals(mimeToExt("application/x-weird"), "bin");
});
