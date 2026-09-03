import { assertEquals } from "jsr:@std/assert@1";
import {
  classifyAssignee,
  defaultDueIso,
  parseNganCommand,
  parseThaiDue,
} from "./parse-ngan.ts";

// 2026-09-03 12:00 Bangkok == 2026-09-03T05:00:00Z
const NOW = new Date("2026-09-03T05:00:00Z");

Deno.test("no trigger", () => {
  assertEquals(parseNganCommand("hello world"), { ok: false, reason: "no_trigger" });
});

Deno.test("trigger without title", () => {
  assertEquals(parseNganCommand("#งาน   "), { ok: false, reason: "missing_title" });
});

Deno.test("title only", () => {
  assertEquals(parseNganCommand("#งาน ซื้อของเข้าบ้าน"), {
    ok: true,
    title: "ซื้อของเข้าบ้าน",
    dueRaw: null,
    assigneeRaw: null,
  });
});

Deno.test("title + due + assignee lines", () => {
  const r = parseNganCommand(
    "#งาน จ่ายค่าน้ำ\nกำหนด: 15/09/2026 18:00\nผู้รับผิดชอบ: สมชาย",
  );
  assertEquals(r, {
    ok: true,
    title: "จ่ายค่าน้ำ",
    dueRaw: "15/09/2026 18:00",
    assigneeRaw: "สมชาย",
  });
});

Deno.test("trigger mid-text picks first line after trigger", () => {
  const r = parseNganCommand("โน้ต\n#งาน เก็บกวาดบ้าน\nกำหนด: พรุ่งนี้");
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.title, "เก็บกวาดบ้าน");
    assertEquals(r.dueRaw, "พรุ่งนี้");
  }
});

Deno.test("parseThaiDue DD/MM/YYYY HH:mm", () => {
  assertEquals(parseThaiDue("15/09/2026 18:00", NOW), {
    iso: "2026-09-15T11:00:00.000Z",
    error: false,
  });
});

Deno.test("parseThaiDue Buddhist-era year", () => {
  assertEquals(parseThaiDue("15/09/2569 18:00", NOW).iso, "2026-09-15T11:00:00.000Z");
});

Deno.test("parseThaiDue DD/MM defaults 09:00 current year", () => {
  assertEquals(parseThaiDue("20/09", NOW).iso, "2026-09-20T02:00:00.000Z");
});

Deno.test("parseThaiDue พรุ่งนี้ + time", () => {
  assertEquals(parseThaiDue("พรุ่งนี้ 08:30", NOW).iso, "2026-09-04T01:30:00.000Z");
});

Deno.test("parseThaiDue bare time already past -> tomorrow", () => {
  // now is 12:00 Bangkok; 09:00 is past -> next day
  assertEquals(parseThaiDue("09:00", NOW).iso, "2026-09-04T02:00:00.000Z");
});

Deno.test("parseThaiDue unparseable -> error", () => {
  assertEquals(parseThaiDue("สัปดาห์หน้า", NOW), { iso: null, error: true });
});

Deno.test("parseThaiDue null -> no error", () => {
  assertEquals(parseThaiDue(null, NOW), { iso: null, error: false });
});

Deno.test("defaultDueIso is tomorrow 09:00 Bangkok", () => {
  assertEquals(defaultDueIso(NOW), "2026-09-04T02:00:00.000Z");
});

Deno.test("classifyAssignee", () => {
  assertEquals(classifyAssignee(null), { kind: "none" });
  assertEquals(classifyAssignee("ฉัน"), { kind: "self" });
  assertEquals(classifyAssignee("ทุกคน"), { kind: "all" });
  assertEquals(classifyAssignee("สมหญิง"), { kind: "name", value: "สมหญิง" });
});
