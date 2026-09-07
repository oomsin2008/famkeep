import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultFilenameFromOriginal,
  fallbackImageFilename,
  sanitizeFilename,
} from "./filename";

const fixed = new Date("2026-09-07T02:15:00.000Z");

test("sanitizes forbidden filename characters and keeps the original extension", () => {
  const name = sanitizeFilename(
    'รายงาน / ครอบครัว: เดือน*กันยายน? "2569"',
    "photo.PNG",
    fixed,
  );

  assert.equal(name, "รายงาน ครอบครัว เดือน กันยายน 2569.png");
});

test("does not duplicate the extension when a filename is sanitized again", () => {
  const once = sanitizeFilename("ขั้นตอนการทำพาสปอร์ต.png", "upload.PNG", fixed);
  const twice = sanitizeFilename(once, "upload.PNG", fixed);

  assert.equal(once, "ขั้นตอนการทำพาสปอร์ต.png");
  assert.equal(twice, "ขั้นตอนการทำพาสปอร์ต.png");
});

test("falls back to a Bangkok timestamp filename when the stem is empty", () => {
  assert.equal(sanitizeFilename("   ", "IMG_001.jpeg", fixed), "รูป_2026-09-07_0915.jpeg");
  assert.equal(fallbackImageFilename("IMG_001.jpeg", fixed), "รูป_2026-09-07_0915.jpeg");
});

test("defaultFilenameFromOriginal keeps the original name and extension", () => {
  assert.equal(
    defaultFilenameFromOriginal("ทะเบียนบ้าน หน้า 1.jpg", fixed),
    "ทะเบียนบ้าน หน้า 1.jpg",
  );
  assert.equal(
    defaultFilenameFromOriginal("IMG_20260907.jpeg", fixed),
    "IMG_20260907.jpeg",
  );
});

test("defaultFilenameFromOriginal falls back when the stem has no real text", () => {
  assert.equal(
    defaultFilenameFromOriginal("_.jpg", fixed),
    "รูป_2026-09-07_0915.jpg",
  );
});
