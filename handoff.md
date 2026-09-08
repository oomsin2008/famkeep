# KitiButler Handoff

Last updated: 2026-09-08 (session 3)

Renamed FamKeep -> KitiButler on 2026-09-08: in-app strings, wordmark, icons,
package name, Vercel domain and GitHub repo are all cut over. Supabase project
ref, pg_cron job names and the `famkeep_worker_secret` vault key are
deliberately left unchanged. The local working directory is still named
`famkeep`.

Edge functions after session 3: `line-webhook` v20, `line-worker` v14
(both `verify_jwt: false`, pinned in `supabase/config.toml`).
Migrations applied to remote via MCP through `20260908140000`.
LINE rich menu is live and set as the default for all users.

Repo:

```text
D:\00_SourceCode\00_AI_App\famkeep
```

Production:

```text
https://kitibutler.vercel.app
```

Supabase project ref:

```text
zuoejigurotylrcisycw
```

GitHub:

```text
https://github.com/oomsin2008/kitibutler
```

## Current User Request / State

### Session 3 (2026-09-08) — rebrand + LINE flow + filters

18 commits, `c40ddf6`..`18131a4`, all pushed. GitHub pushes were slow/failing
all session (intermittent github.com:443 connectivity) — commits are local-safe,
edge deploys go straight from the working tree so they don't wait on git.

**Rebrand FamKeep -> KitiButler** (`c40ddf6`, `51770d9`, `f3e69e3`)
- Strings, wordmark ("KitiButler"), `/help` copy, `package.json` name, docs.
- Brand art: `public/brand/kitibutler-logo.png` + `src/app/{icon,apple-icon,
  favicon}` regenerated from the AI-butler logo (`AI Butler (Logo1).png`,
  gitignored) via ffmpeg. favicon.ico must embed an RGBA PNG or turbopack's
  build fails ("The PNG is not in RGBA format").
- `supabase/config.toml`: added `[functions.line-webhook]` / `[functions.
  line-worker]` `verify_jwt = false` so a plain `functions deploy` keeps it off.
- External cutover done by the user: Vercel domain `kitibutler.vercel.app`
  (primary, old removed), Vercel project renamed, GitHub repo renamed
  `oomsin2008/kitibutler` + `git remote set-url`, Supabase Auth Site URL +
  Redirect URLs, Edge secret `APP_PUBLIC_URL`. LINE Login callback needed no
  change (custom:line calls back to `<ref>.supabase.co/auth/v1/callback`).
- LINE channel access token was pasted into the session -> user reissued it,
  updated the `LINE_CHANNEL_ACCESS_TOKEN` Supabase secret, redeployed both fns.
- Deliberately NOT renamed: supabase project ref, pg_cron jobs, vault secret
  `famkeep_worker_secret`, local dir, memory-file slugs.

**Profile / nav** (`e34b7a3`, `ba7fda6`, `07c9284`)
- Top-nav avatar shows the LINE profile picture (`CurrentUserProvider` +
  `NavAvatar`, client-fetched), falls back to the generic icon.
- Settings profile card: email line removed (LINE Login returns no email; not
  applying for the permission).
- Logo / "KitiButler" wordmark top-left now links to `/help` (home stays in the
  nav). aria-label -> "KitiButler คู่มือการใช้งาน".

**Tasks multi-select** (`c47f29c`) — same pattern as the Locker. "เลือก" mode,
checkboxes, เลือกทั้งหมด, bulk "ลบ (N)" one-tap confirm. `deleteTasksAction`
loops `soft_delete_task`. Works for private + family tasks. `TaskRow` gained
`selectMode`/`selected`/`onToggleSelect`; in select mode the row is a toggle
button, not a link.

**/help + rich menu + เมนู** (`efb40cb`, `2666a33`)
- `src/app/help/page.tsx` — static, no auth gate (builds `○`). #งาน syntax,
  file saving, `#ชื่อไฟล์`, reminders, `ไอดี`, `เมนู`.
- `scripts/line-rich-menu/` — `rich-menu.json` (6 cells 2x3: หน้าหลัก /
  งานทั้งหมด / ปฏิทิน / คลังไฟล์ = uri; สร้างงาน = message `#งาน`;
  วิธีใช้งาน = message `เมนู`), `rich-menu.jpg` (2500x1686), `deploy.mjs`
  (delete existing -> create -> upload image -> set default). Deployed live;
  run `deploy.mjs` again with `LINE_CHANNEL_ACCESS_TOKEN` to change it.
- webhook: `เมนู`/`menu`/`วิธีใช้`/`help`/`?` -> `menuText()` full command list.

**LINE task flow** (`ccaaeca`, `7e32736`) + migration `20260908120000`
- `create_task_from_line` now auto-inserts an `at_due_time` reminder (slot 1),
  so every #งาน task pings at its due time. Removable in the web app.
- `set_task_lifecycle_from_line(task_id, actor_profile_id, status)` — new,
  service_role, `can_access_task` gate. Backs a "เสร็จแล้ว" postback button
  (`data: done:<taskId>`) on `reminderFlex` ONLY (not `taskCreatedFlex` — the
  user wanted it on the reminder bubble only). webhook handles
  `event.type === "postback"` in `handlePostback`.
- Reverses the old "no in-LINE task-complete buttons" decision, at user request.

**#งาน voice parsing** (`1d36754`, `74c1e3d`, `315dc0b`) + migration `20260908140000`
- Type `#งาน`, dictate the rest: one line, no ":", Thai-word numbers.
- `parseNganCommand` splits fields inline: `กำหนด`/`วันที่`/`เวลา` (เวลา is
  guarded — must be followed by a time token) and
  `ผู้รับผิดชอบ`/`ผู้รับ`/`มอบหมาย(ให้)`, any order, keyword ignored if it's the
  first word. Multi-line + ":" still works.
- `parseTimeOfDay`: `H นาฬิกา [MM]`, `H[:MM] am/pm`, `บ่าย N [โมง]`,
  `N โมงเย็น`/`เย็น N`, `N ทุ่ม` (`ทุ่มนึง`), `ตี N`, `N โมงเช้า`/`เช้า N`,
  `N โมง` (6-11 = morning), `เที่ยง`/`เที่ยงคืน`, trailing `ครึ่ง` -> :30,
  Thai-word numbers 1-11.
- `resolve_family_member_by_name` retries space-insensitively (STT splits names).
- 29 tests in `supabase/functions/_shared/parse-ngan.test.ts`.

**Calendar + `ไอดี`** (`f8ce1af`, `01f6333`)
- Calendar mobile: `สัปดาห์ / เดือน` toggle; month = compact one-dot-per-day
  grid (`MobileMonthGrid`). Desktop unchanged. `dominantStatus` moved to
  `lib/tasks.ts`.
- `ไอดี` / `id` / `ไลน์ไอดี` DM to the bot (1:1 only) -> replies with the
  sender's LINE user ID, for family onboarding (the id isn't visible anywhere
  else). In a group -> "1:1 only" note.

**3-way ownership filter** (`18131a4`, `e2db732`)
- New `OwnershipFilter = "all" | Workspace` in `lib/types.ts`.
- Tasks: default filter `all` -> `private`.
- Locker: adds a "ทั้งหมด" tab (was private/family only). `FilesProvider`
  `lockerTab` widened to `OwnershipFilter`.
- Calendar: gains the 3-way filter, sharing state with the Tasks page
  (`useTasks().filter`). Tabs in-page on mobile, in `TopNavContextTabs` on
  desktop.
- `/help` #งาน section rewritten for the voice syntax.

**Pending / needs the user**
- `18131a4` Vercel deploy (calendar filter) — pushed, deploying at handoff time.
  User tested before it landed and saw no filtering; that was expected.
- Confirm the LINE **Login** channel is "Published" — otherwise family members
  who aren't channel admins/testers can't sign in. (Console -> LINE Login
  channel -> status badge; "Publish" button; usually no review.)
- Confirm the reissued LINE token is the one now in the Supabase secret.
- Family onboarding: share the bot link -> each member signs in ->
  each DMs `ไอดี` -> owner adds them in ตั้งค่า -> ครอบครัว -> add bot to the
  family LINE group -> approve it in ตั้งค่า -> การเชื่อมต่อ LINE.
- DB state: 1 family workspace (2 members), 1 family task, 5 private tasks.

### Session 2h (2026-09-07) — Locker: multi-select

`/locker` "ลบทั้งหมด" button removed (the `/settings/reset` flow covers that
need). New "เลือก" mode: checkboxes on each card / row + a selection bar with
เลือกทั้งหมด, ดาวน์โหลด (N) (staggered per-file `<a download>`), ลบ (N)
(one-tap Popover confirm → `deleteFilesAction(ids)` loops the `file-delete`
Edge Function). Single delete + single download unchanged.
`FileCard` / `FileRow` / `LockerTableRow` gained optional
`selectMode` / `selected` / `onToggle*` props; Home's `FileRow` unaffected.
`deleteAllMyFilesAction` → `deleteFilesAction(ids[])` in `file-actions.ts`.
Web only, no deploy. Committed `806ec54`.

### Session 2g (2026-09-07) — Settings: owner-only data reset

New `/settings/reset` ("ล้างข้อมูล", in the sidebar + drilldown + back-header).
Family-owner only (`is_family_owner()` = holds the `owner` role in a family
workspace); a non-owner sees an explanatory card.

- 3 typed-confirm actions (`DangerConfirmDialog`, reusable): ล้างคลังไฟล์
  (phrase "ล้างไฟล์"), ล้างงานและปฏิทิน ("ล้างงาน"), เริ่มใหม่ทั้งหมด
  ("เริ่มใหม่ทั้งหมด"). Each covers the caller's private + family workspaces.
- `src/lib/settings/reset-actions.ts`: `wipeFilesAction` loops the
  `file-delete` Edge Function (soft-delete + moves the Drive original to the
  cleanup folder); `wipeTasksAction` → `owner_wipe_tasks()` RPC;
  `resetAllAction` = both. Every action re-checks `is_family_owner`.
- migration `20260907180000`: `is_family_owner()` + `owner_wipe_tasks()`,
  SECURITY DEFINER, `authenticated` only, owner-gated. Applied via MCP.
- Calendar has no data of its own (renders tasks) → clearing tasks clears it.
- Other members' private lockers are never touched (RLS scope). LINE
  connection + family membership are left intact.

tsc / lint / test / build pass. Committed `cd721fe`, pushed. No deploy needed.
NOT tested end-to-end (would wipe the real 11 files / 7 tasks) — the owner gate
and the wipe targeting (7 tasks / 11 files) were verified read-only.

### Session 2f (2026-09-07) — Settings: real profile + edit display name

`GeneralSection` was the last mock-data component. Now:
- `/settings/page.tsx` is a server component behind `requireUser()`, loads the
  real profile via `getOwnProfile()` (`src/lib/auth/profile.ts`).
- The disabled "แก้ไขโปรไฟล์" button → a pencil that edits **display_name only**
  inline (email + avatar shown read-only; avatar is the LINE picture).
- `updateDisplayNameAction` (`src/lib/auth/profile-actions.ts`) → RPC
  `update_own_profile(p_display_name)` — column-scoped, `authenticated` only,
  migration `20260907170000` (applied via MCP). Tested live (set + restored).
- `src/lib/mock/data.ts` deleted; `FamilyMember` type removed from `types.ts`.

tsc / lint / test (5) / build pass. Committed `630b07b`, pushed. No deploy
needed (web only).

### Session 2e (2026-09-07) — LINE messages: Flex bubbles + warmer tone (A2 + B2)

User picked option "A2 + B2" from a mockup (artifact
`747d6612-60f9-484b-81e1-10e069ce8892`): confirmation messages become LINE Flex
bubbles with a tinted header + one deep-link button; error/hint messages stay
plain text but reworded warmer. No mascot, no "เสร็จแล้ว"-from-LINE button, no
multi-file batching.

Changed:
- **`supabase/functions/_shared/line.ts`** — added `LineFlexMessage`
  (`type:"flex"`, `altText`, `contents`) and `LineMessage` union;
  `replyMessage` / `pushMessage` now take `LineMessage[]`.
- **`supabase/functions/_shared/line-flex.ts`** (new) — bubble builders:
  `savedFileFlex`, `duplicateFileFlex`, `renamedFileFlex`, `taskCreatedFlex`,
  `reminderFlex`. Colors mirror the app tokens. Header uses a light tint +
  dark ink (not the solid-red bars from the user's reference image). Every
  builder returns a bubble with `altText`; `link: null` (no `APP_PUBLIC_URL`)
  just drops the footer button.
- **`line-webhook/index.ts`** — file-save / duplicate / rename / task-created
  replies now return Flex. `tryReply`/`replyWith` accept `string | LineMessage`.
  Added `taskLink()`. `formatDue()` now `"อ. 16 ก.ย. 2569 · 10:00"`.
  Reworded `HINT_*`, `MSG_*`, `KEEP_HINT`, `reasonToThai`, inline error strings.
- **`line-worker/index.ts`** — reminder push is now `reminderFlex`; preset
  labels reworded ("อีก 10 นาทีถึงกำหนด" etc.); `at_due_time` → red tone, others
  → amber. Reads `APP_PUBLIC_URL` for the "เปิดงานนี้" button.
- **Migration `20260907160000_reminder_dispatch_task_id.sql`** (applied via MCP)
  — `reminder_dispatch_info` dropped + recreated with a trailing `task_id uuid`
  column so the reminder bubble can deep-link. Grants re-locked to
  `service_role` only.

Verified: `deno check` (isolated copy, `--node-modules-dir=auto` in scratchpad
only — never the repo root) passes for both entrypoints + line-flex; app
`tsc` + `lint` clean.

DEPLOYED + tested working 2026-09-07: `line-webhook` v12, `line-worker` v10.
Image save / task-created / rename bubbles confirmed rendering in LINE with
buttons (`APP_PUBLIC_URL` secret was already set). Reminder push bubble not yet
seen live (waits for a real due time).

Deploy gotcha found: `supabase functions deploy` does NOT upload
`supabase/functions/deno.json`, so a bare `@supabase/supabase-js` specifier
fails to bundle (`Relative import path ... not prefixed`). Fix: both LINE
functions now `import { createClient } from "npm:@supabase/supabase-js@2"`
directly, like `file-upload` / `file-rename`. `file-download` / `file-delete`
still use the bare specifier + import map — migrate them the same way before
their next redeploy.

Follow-up: `renamedFileFlex` icon now derived from the filename extension
(`kindFromName` in `line-flex.ts`) instead of a hardcoded 📄.

### Session 2d (2026-09-07) — OCR removed entirely

The user decided on-device OCR is not fit for use ("ยังไม่เหมาะกับการใช้งาน")
and asked to remove the OCR function, the "ตั้งชื่อด้วย OCR" button, and every
OCR-related file. **This supersedes every OCR reference below** (Session 2's
"OCR reworked" notes, the "Offline OCR upload" spec section, the Tesseract
package/asset lists). Do not re-add OCR without a new explicit request.

Removed:
- `tesseract.js`, `@tesseract.js-data/eng`, `@tesseract.js-data/tha` from
  `package.json` (ran `npm install`); `public/tesseract/` (8 MB of wasm +
  traineddata) deleted; the `public/tesseract/**` ignore line reverted out of
  `eslint.config.mjs`.
- `src/lib/ocr-filename.ts` → replaced by `src/lib/filename.ts` (kept only the
  non-OCR helpers: `sanitizeFilename`, `defaultFilenameFromOriginal`,
  `fallbackImageFilename`). All title-scoring code (`bestTitleLine`,
  `titleScore`, `prominentWords`, `suggestImageFilenameFromOcr`) is gone.
- `src/lib/ocr-filename.test.ts` → `src/lib/filename.test.ts` (5 tests, pass).
  `package.json` `test` script points at the new path.
- `src/components/files/ImageOcrUploader.tsx` →
  `src/components/files/UploadImageDialog.tsx`. Still a Radix Dialog opened by
  the "อัปโหลดรูป" toolbar pill on `/locker`. Flow is now: pick image → preview
  → edit filename (defaults to the original file's own name via
  `defaultFilenameFromOriginal`) → "บันทึกเข้าคลัง". No language picker, no
  progress bar, no Tesseract worker.

Kept unchanged: the `/api/files/upload` same-origin proxy, the `file-upload`
Edge Function (v4), the `web_upload_workspace_id` RPC, the 4 MB limit. The
manual web image upload itself still works; only OCR was stripped.

tsc / lint / test (5) / build all pass after the removal.

### Session 2 (2026-09-07) — upload bug FIXED (verified end-to-end), OCR reworked

Status: `บันทึกเข้าคลัง` works. Real web upload confirmed 2026-09-07 05:49 UTC —
`files` row `2ac0dd88-...` "Mahidol Alumni.jpg", kind image, private workspace
`da71decf-...`, `saved_via_line = false`, file visible in the Locker. Three
stacked bugs were fixed (details below): cross-origin browser fetch, a
nonexistent-column filter, and a `service_role` table-permission denial.
`file-upload` is deployed at version 4.

Root cause of "บันทึกเข้าคลัง" failure, from `function_edge_logs` on project
`zuoejigurotylrcisycw`:

- Browser (Chrome) multipart `POST` to
  `https://zuoejigurotylrcisycw.supabase.co/functions/v1/file-upload`
  (content-length ~367 KB) returns **404 at the Supabase gateway**. `OPTIONS`
  returns 200. The function never runs (no `X-FK-Stage`, no boot correlation to
  the POST).
- The PowerShell test (no body) returned 401 `session_invalid` correctly, which
  is why it looked deployed-and-fine. The multipart path was never actually
  exercised until the browser hit it.
- Verified good and NOT the cause: migrations `web_image_upload` /
  `web_file_rename` applied; RPC `create_file_from_web_upload` exists with
  `service_role` execute; Google Drive secrets present (a POST reached the token
  check and returned 401, not 503 `drive_not_configured`); function code (401
  path executed, boot 30 ms, no boot error).

Fix: browser no longer calls the Edge Function directly. New same-origin route
`src/app/api/files/upload/route.ts` reads the Supabase session from cookies and
forwards the multipart body to `file-upload` server-side, same pattern as the
working `src/app/api/files/[id]/content/route.ts`.

OCR decision: the "keep OCR offline, no cloud OCR API" constraint was
re-asked and **reaffirmed by the user on 2026-09-07**. OCR stays 100 % on-device
(Tesseract.js). Do not relitigate.

Bugs found once the proxy let the request through (2026-09-07, confirmed by
`console.log` in `function_logs`):

1. `resolveWorkspace()` filtered `workspaces` on `.is("deleted_at", null)` but
   `public.workspaces` has no `deleted_at` column (id, type, name,
   owner_profile_id, created_at, updated_at). Removed the filters — then:
2. `resolveWorkspace()` did `admin.from("workspaces").select(...)` as
   `service_role`, which fails with **`permission denied for table workspaces`**
   — this project gives service_role NO table-level DML on any public table;
   every backend read goes through a SECURITY DEFINER RPC (same class of bug as
   `file-download` in Phase 7.6c-fix-2). Log line:
   `resolveWorkspace private error permission denied for table workspaces`.

Fix: migration `20260907120000_web_upload_workspace_resolver.sql` adds
`web_upload_workspace_id(p_actor_profile_id uuid, p_choice text) returns uuid`
(SECURITY DEFINER, search_path='', service_role only, self-authorizing —
private = own workspace, family = a workspace you're a member of). Applied to
remote via MCP. `resolveWorkspace()` now calls that RPC.
`create_file_from_web_upload` still does its own `can_access_workspace` check.
**Requires redeploy of `file-upload`.**

Also confirmed working from the logs: the same-origin proxy delivers the browser's
exact multipart bytes + `----WebKitFormBoundary...` to the function, and
`admin.auth.getUser(token)` resolves the `custom:line` user correctly. The proxy
forwards the raw body as an ArrayBuffer (original Content-Type), not a
re-serialized FormData.

### Session 1 original notes (kept for history)

- In `http://localhost:3000/locker`, the OCR upload flow errored on
  "บันทึกเข้าคลัง" with `TypeError: Failed to fetch` at the direct
  `fetch(`${base}/functions/v1/file-upload`)` call. This is the same gateway 404
  described above — the browser `fetch` surfaces a gateway 404 on a
  cross-origin multipart POST as `Failed to fetch`.

## Required Working Rules

From `AGENTS.md`:

- This is Next.js 16. Read relevant docs in `node_modules/next/dist/docs/` before changing Next code.
- Keep the tree clean where possible; AGENTS.md block is generated by Next and should not be removed casually.

Project security rules that must not be violated:

- Never expose Supabase service role in browser.
- Never expose Google tokens, LINE tokens, or other secrets in browser.
- Never expose `drive_file_id` to client code.
- LINE webhook must verify raw body signature before parsing.
- File preview/download must go through same-origin secure proxy / Edge Function, not direct Drive public URLs.
- Google Drive files remain private.
- RLS remains the primary access boundary.
- `line_conversations` is the source of truth for LINE user/group mapping.
- Do not add `line_group_id` to `workspaces`.
- Browser must not update `profiles.line_user_id`.
- Private workspace must not have `workspace_members`.

User preference:

- User prefers not to be asked for approval repeatedly.
- User wanted Codex to coordinate with Claude CLI using Advisor as Opus 5 when possible. During this work, `claude -p ... --model opus` timed out twice, so no useful Claude review was obtained.

## Session 2 File Changes (2026-09-07, uncommitted)

New:

- `src/app/api/files/upload/route.ts` — same-origin upload proxy. Caps body at
  4 MB (Vercel route-handler request-body limit is ~4.5 MB). Relays the edge
  function's JSON + `X-FK-Stage`.

Changed:

- `src/components/files/ImageOcrUploader.tsx`
  - `upload()` now POSTs to `/api/files/upload` (no Supabase URL, no CORS, no
    client-side session fetch).
  - On file pick: filename defaults to `defaultFilenameFromOriginal(file.name)`
    and **OCR no longer auto-runs**.
  - New "ตั้งชื่อด้วย OCR" button (`runOcr`) triggers OCR on demand; becomes
    "อ่านใหม่อีกครั้ง" after a run. `retryOcr` removed (merged into `runOcr`).
  - OCR empty-result / failure now falls back to the original filename, not a
    timestamp.
  - Upload cap 5 MB → 4 MB (copy + `MAX_UPLOAD_BYTES`).
  - `uploadError` map gained `not_configured`, `no_file`, `bad_form`,
    `upstream_unavailable`, `bad_response`.
  - Header copy changed; still states OCR is on-device.
- `src/lib/ocr-filename.ts`
  - New export `defaultFilenameFromOriginal(originalName, date?)`.
  - Rewrote line selection: `bestTitleLine` scores every line (char-based, so it
    works for spaceless Thai) and picks the best over `MIN_TITLE_SCORE`, instead
    of returning the first line over a trivial bar (which grabbed
    headers/watermarks). `prominentWords` handles spaceless Thai. Removed
    `meaningfulScore`, `bestLine`.
- `src/lib/ocr-filename.test.ts` — added: spaceless Thai title, noisy-first-line
  skip, `defaultFilenameFromOriginal`. All 7 pass.
- `supabase/functions/file-upload/index.ts` — (1) web cap is now a local
  `WEB_UPLOAD_MAX_BYTES = 4 MB` (was shared `MAX_UPLOAD_BYTES` 5 MB, which LINE
  ingestion still uses); (2) `resolveWorkspace()` now calls the
  `web_upload_workspace_id` RPC instead of querying `workspaces` directly (was
  `permission denied` as service_role); (3) `console.error` on formData failure
  and RPC error. **MUST be redeployed** —
  `npx supabase functions deploy file-upload --project-ref zuoejigurotylrcisycw --no-verify-jwt`.
- `supabase/functions/file-rename/index.ts` — NOT audited for the same
  `service_role`-direct-table-read bug. It calls RPCs (`prepare_file_rename`
  etc.) so it is probably fine, and its RPCs fired successfully once in the
  logs, but verify if web rename misbehaves.
- `supabase/migrations/20260907120000_web_upload_workspace_resolver.sql` — new,
  already applied to remote via MCP.

Local checks pass: `npm test`, `npx tsc --noEmit`, `npm run lint`,
`npm run build`, `deno check supabase/functions/file-upload/index.ts`.

### Session 2b (2026-09-07) — Locker/Tasks layout changes

- Upload is now a **modal**, not an inline card. `ImageOcrUploader.tsx` exports
  `UploadImageDialog` (Radix Dialog): an "อัปโหลดรูป" pill button in the Locker
  toolbar (next to sort + view toggle) opens the pick/OCR/rename/save flow in a
  dialog. Target Locker = the active `lockerTab`; shown in the dialog. Closing
  while `isUploading` is blocked; otherwise close resets the picker.
- Ownership tabs moved into the top nav bar **at `lg`+** (not `md` — the nav
  overflows at 768–1024 px with the extra pill). New
  `src/components/shell/TopNavContextTabs.tsx` (rendered in `DesktopTopNav`,
  right cluster): Locker private/family on `/locker*`, task all/private/family
  on exactly `/tasks`, nothing elsewhere. State still lives in the layout-level
  providers — only the control relocated; it reads them through new
  non-throwing `useLockerTabControls()` / `useTaskFilterControls()` hooks so the
  shell keeps no hard provider dependency.
- `LockerView.tsx` / `TasksView.tsx` keep their inline tab bars, wrapped
  `lg:hidden` (below lg there is no room in the top bar); top margins `lg:mt-0`.
- Grid file cards (`FileCard.tsx`) gained an inline **rename**: pencil button →
  edit the stem only (extension shown fixed, never sent), check to save,
  X/Escape to cancel, Enter to save. Calls new server action
  `renameFileAction(fileId, name)` in `src/lib/files/file-actions.ts` (mirrors
  `deleteFileAction` — forwards to the `file-rename` Edge Function server-side
  with the session token; the function keeps the original extension via
  `renamePreservingExtension`). `router.refresh()` on success. No deploy needed —
  `file-rename` was already deployed in session 1 and its RPCs
  (`prepare_file_rename`, `rename_file_metadata_from_web`) are verified good.
- `FileDetailModal.tsx` still renames via a direct browser fetch to the Edge
  Function (works — JSON POST, unlike the multipart upload). Could be migrated to
  `renameFileAction` for consistency; left alone to avoid regressing a working
  path.

### Session 2c (2026-09-07) — delete files & tasks (reverses locked decision #7)

Migration `20260907140000_soft_delete_tasks.sql` (applied via MCP): RPCs
`soft_delete_task(p_task_id)` (auth via `can_access_task`) and
`soft_delete_all_my_tasks()` (all statuses in the caller's private workspace,
returns count). Both SECURITY DEFINER, search_path='', grant authenticated.
Single-delete tested live (works); bulk untested (classifier blocked the
mass-mutation test — will be exercised via the typed-phrase UI). `tasks` already
has `deleted_at` and every read path + `enqueue_due_reminders` filters it.

Files: no migration/redeploy — `deleteAllMyFilesAction` lists the user's private
file ids (RLS client) and loops the existing `file-delete` Edge Function.

Server actions: `deleteTaskAction`, `deleteAllMyTasksAction` (`task-actions.ts`);
`deleteAllMyFilesAction` (`file-actions.ts`); `deleteFileAction` already existed.

UI:
- `src/components/ui/InlineDeleteButton.tsx` — trash icon → Radix Popover
  one-tap confirm (no typing). Single-item only.
- `src/components/ui/DeleteAllDialog.tsx` — "ลบทั้งหมด" pill → Radix Dialog that
  requires typing the exact phrase "ลบทั้งหมด" before the delete button enables.
- `FileCard`: pencil + delete moved to a top-right overlay on the thumbnail
  (footer stays eye + download). `FileRow` / `LockerTableRow`: inline delete
  (table cell stops click propagation so it doesn't open the modal).
- `LockerView`: `<DeleteAllDialog noun="ไฟล์">` in the toolbar, only on the
  "ของฉัน" tab.
- `TaskRow`: restructured — outer `<div class="fk-row">`, inner `<Link>` for
  navigation, optional `<InlineDeleteButton>` sibling (new `deletable` prop,
  passed only by `TasksView` — not Home/Calendar). `onConfirm` is
  `deleteTaskAction.bind(null, task.id)`.
- `TasksView`: `<DeleteAllDialog noun="งาน">` next to "สร้างงานใหม่", only when
  the filter is "ของฉัน".

Checks pass: tsc, lint, test (7/7), build. Not yet visually verified or
end-to-end tested by the user.

CAUTION for the next session: `deno check --node-modules-dir=auto` rewrites the
project's `node_modules` into Deno's layout and repoints `node_modules/.bin/*`.
If it is interrupted, or `node_modules/.deno` is deleted afterward, `npm run
lint` breaks with MODULE_NOT_FOUND — fix with `npm install`. Prefer
`deno check` without `--node-modules-dir=auto`, or run `npm install` after.

Not verified end-to-end: a real browser upload (needs auth + running app). User
to test with `npm run dev` against the remote Supabase project.

What is NOT solved: Tesseract's raw recognition accuracy on Thai photos is
unchanged. The heuristic bugs are fixed and the original-name default protects
against bad names, but if OCR-suggested names are still poor the gap is engine
accuracy, not the filename logic.

## Original Project Summary

KitiButler is a LINE-first family productivity app.

MVP goals:

- Login with LINE.
- Private user workspace.
- Family workspace.
- Create tasks from web and from LINE command `#งาน`.
- Send reminders back through LINE.
- Store files from LINE into Google Drive.
- Web Locker can preview/download files.
- Production deploy on Vercel.

Tech stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Phosphor Icons
- Radix UI
- Supabase PostgreSQL/Auth/Edge Functions
- Custom OAuth2 Provider for LINE Login
- Supabase Cron / pg_cron
- pg_net for worker calls
- Supabase Vault for worker shared secret
- Google Drive as file storage source of truth
- Supabase stores file metadata only
- Vercel for Next.js app

LINE identity:

- LINE Login and Messaging API channel must be under the same LINE Developer Provider.
- Supabase Custom OAuth2 provider is used.
- Provider identifier: `custom:line`.
- LINE `sub` is mapped to `profiles.line_user_id`.
- Confirmed identity shape:

```text
auth.identities.provider = custom:line
LINE sub path = user.identities[0].identity_data.sub
```

Workspaces:

- Private workspace is created automatically after login.
- Private workspace: `type = private`, `owner_profile_id = auth.uid()`, no `workspace_members`.
- Family workspace is created through web UI.
- Family workspace: `type = family`, `owner_profile_id = null`, membership in `workspace_members`.
- Owner manages members.

LINE conversations:

```text
LINE userId  -> line_conversations -> profile_id
LINE groupId -> line_conversations -> workspace_id
```

Tasks:

- Lifecycle values: `open`, `done`, `cancelled`.
- Derived values: `overdue`, `duesoon`, `progress`.
- `done` and `cancelled` always override derived status.
- Due soon = within 2 calendar days.
- Display timezone = Asia/Bangkok.
- Backend timestamps = UTC.
- Task workspace cannot change after creation.
- No delete task in MVP.

Reminder presets:

```text
at_due_time
ten_minutes_before
one_day_before
morning_of_due
```

Retired preset:

```text
three_hours_before
```

Reminder DB hard limits:

- Max 2 reminders per task.
- Enforced by `slot in (1,2)`, unique `(task_id, slot)`, unique `(task_id, preset)`.

Completed earlier phases:

- Phase 0-6 frontend MVP UI.
- Phase 7.1 Supabase initial schema.
- Phase 7.2 Auth/Profile/Workspace.
- Phase 7.3 Tasks persistence.
- Phase 7.4-7.5 LINE Messaging, `#งาน`, reminder scheduler.
- Reminder preset update.
- Phase 7.6 Files + Locker + Google Drive.
- Secure file preview/download through proxy.
- File delete/sort groundwork.
- LINE file save deep link.
- Production deploy on Vercel.
- UI redesign v3 was reportedly done but still uncommitted in the handoff.

Earlier production tests reportedly passed:

- LINE Login on production.
- LINE 1:1 sends image/file and saves into Locker.
- LINE reply link opens KitiButler.
- Web preview/download works through Google Drive proxy.
- Web task creation works.
- Reminder at due time sends LINE message.

## Work Completed In This Session

### 1. Navigation performance / perceived loading

Problem:

- On `https://famkeep.vercel.app/`, clicking menus like Locker/Tasks/Home/Overdue took around 5 seconds before data appeared.
- On `http://localhost:3000/`, navigation was around 1-2 seconds.
- User did not know whether clicks were working.

Likely cause identified:

- Next.js dynamic server-rendered routes combined with production region latency.
- Vercel region likely farther from Supabase/Thailand.
- The pages `/`, `/tasks`, `/calendar`, `/locker` are dynamic server-rendered on demand.

Changes made:

- Added route loading skeletons:
  - `src/app/loading.tsx`
  - `src/app/tasks/loading.tsx`
  - `src/app/calendar/loading.tsx`
  - `src/app/locker/loading.tsx`
  - `src/app/settings/loading.tsx`
  - `src/components/ui/Skeletons.tsx`
- Added pending navigation hint:
  - `src/components/ui/LinkPendingHint.tsx`
  - updated `src/components/shell/DesktopTopNav.tsx`
  - updated `src/components/shell/MobileBottomNav.tsx`
  - updated `src/app/globals.css`
  - updated `src/components/home/HomeView.tsx`
- Added `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```

### 2. Locker UI like Google Drive

User requested Google Drive-like Locker controls:

- List/grid view toggle.
- Sort menu.
- Grid view with previews.
- Default view should be grid with preview.

Changes made:

- `src/components/files/LockerView.tsx`
  - default view changed to grid.
  - added Drive-style sort popover.
  - added list/grid toggle.
- `src/components/files/FileCard.tsx`
  - added image thumbnail preview through `/api/files/${id}/content?disposition=inline`.
  - added lazy PDF iframe thumbnail preview through same proxy.
  - added card actions for preview/open/download.
- `src/components/files/FileDetailModal.tsx`
  - already supports image and PDF preview in modal.

### 3. Offline OCR upload for Web/PWA

User requested:

- Offline OCR 100% on user device for uploaded images.
- No image/OCR text/data sent to external OCR APIs/cloud.
- For Web/PWA, use Tesseract.js and Web Worker.
- Load Thai/English language data only as needed.
- Show progress such as `กำลังอ่านข้อความจากรูปภาพ... 45%`.
- Disable save during OCR or allow skip.
- User can edit filename before saving.
- Filename generation priority:
  - meaningful first title/document line,
  - otherwise prominent 3-8 words,
  - otherwise `รูป_YYYY-MM-DD_HHmm`.
- Sanitize forbidden chars: `/ \ : * ? " < > |`.
- Collapse repeated whitespace.
- Max 80 chars.
- Support Thai/English/numbers.
- Preserve original extension.
- Tests for filename selection, sanitize, fallback.
- Do not refactor unrelated code.

Important limitation explained:

- True client-side OCR cannot be applied to images sent directly to LINE Bot, because LINE sends the image to webhook/server. The offline OCR path is the web/PWA upload flow.

Dependencies installed:

- `tesseract.js`
- `@tesseract.js-data/tha`
- `@tesseract.js-data/eng`
- dev dependency `tsx`

`package.json` test script:

```json
"test": "tsx --test src/lib/ocr-filename.test.ts"
```

Tesseract assets copied under:

```text
public/tesseract/worker.min.js
public/tesseract/core/tesseract-core-lstm.wasm
public/tesseract/core/tesseract-core-lstm.wasm.js
public/tesseract/lang-data/eng.traineddata.gz
public/tesseract/lang-data/tha.traineddata.gz
```

`eslint.config.mjs` ignores:

```text
public/tesseract/**
```

Files added:

- `src/lib/ocr-filename.ts`
- `src/lib/ocr-filename.test.ts`
- `src/components/files/ImageOcrUploader.tsx`
- `supabase/migrations/20260907090000_web_image_upload.sql`
- `supabase/functions/file-upload/index.ts`

OCR uploader behavior:

- User selects image in Locker.
- OCR starts client-side with:

```ts
workerPath: "/tesseract/worker.min.js"
corePath: "/tesseract/core/tesseract-core-lstm.wasm.js"
langPath: "/tesseract/lang-data"
gzip: true
```

- Language selector: `tha+eng`, `tha`, `eng`.
- User can skip/cancel/retry OCR.
- Save disabled while OCR is running.
- On upload, browser posts multipart form to:

```text
${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/file-upload
```

- Headers:
  - `Authorization: Bearer <session.access_token>`
  - `apikey: <NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY>`
- Body:
  - `file`
  - `name`
  - `workspace` (`private` or `family`)

### 4. Filename extension duplication fix

Observed bug:

```text
ขั้นตอนการทำพาสปอร์ต.png.png.png
```

Cause:

- `sanitizeFilename(filename, originalName)` appended original extension even when `filename` already included an extension, and could be called repeatedly.

Fix:

- Added `stripFilenameExtension()` in `src/lib/ocr-filename.ts`.
- `sanitizeFilename()` is now idempotent for already-sanitized filenames.

Test added:

```text
does not duplicate the extension when a filename is sanitized again
```

### 5. Web rename for files

User requested ability to rename file through web, keeping links/related data consistent.

Changes made:

- Added `supabase/functions/file-rename/index.ts`.
- Added `supabase/migrations/20260907091000_web_file_rename.sql`.
- Updated `src/components/files/FileDetailModal.tsx`:
  - added pencil icon.
  - user can edit filename in modal.
  - save calls `file-rename` Edge Function.
  - UI updates current modal state and calls `router.refresh()`.
- Updated `src/components/providers/FilesProvider.tsx`:
  - added `renameOpenedFile(fileId, name)`.

Backend rename flow:

1. Browser sends `{ id, name }` to `file-rename`.
2. Function validates Supabase session token with service-role client.
3. RPC `prepare_file_rename` checks access and returns backend-only `drive_file_id`.
4. Function sanitizes requested name with `renamePreservingExtension(rawName, originalName)`.
5. Function renames Google Drive file with `renameDriveFile`.
6. Function updates Supabase metadata with `rename_file_metadata_from_web`.
7. If metadata update fails after Drive rename, function attempts to rename Drive back to original name.

Important:

- Web file links use file `id`, so links remain stable after renaming.
- `drive_file_id` remains server-only.

### 6. LINE rename after save

Previously added in this session:

- Updated `supabase/functions/_shared/drive.ts`:
  - added `renameDriveFile`.
  - added `renamePreservingExtension`.
- Updated `supabase/functions/line-webhook/index.ts`:
  - save reply includes:

```text
หากต้องการเปลี่ยนชื่อ ส่ง: #ชื่อไฟล์ <ชื่อใหม่>
```

  - supports commands:

```text
#ชื่อไฟล์ <ชื่อใหม่>
#เปลี่ยนชื่อ <ชื่อใหม่>
```

  - command renames latest file saved by sender in last 24 hours.
  - renames Drive first, then metadata.

Note:

- LINE rename flow did not yet add rollback if metadata update fails. Web rename has rollback.

## Supabase Remote Actions Already Performed

Database migrations pushed successfully:

```powershell
npx supabase db push
```

Output indicated:

```text
Applying migration 20260907090000_web_image_upload.sql...
Applying migration 20260907091000_web_file_rename.sql...
Finished supabase db push.
```

Functions deployed:

```powershell
npx supabase functions deploy file-upload --no-verify-jwt
npx supabase functions deploy file-rename --no-verify-jwt
```

First parallel deploy attempt failed because `@supabase/supabase-js` bare import could not bundle remotely:

```text
Relative import path "@supabase/supabase-js" not prefixed with / or ./ or ../
```

Fix applied:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
```

Final deploy succeeded for both functions.

Remote `functions list` after deploy showed:

- `file-upload`
  - status: `ACTIVE`
  - version: `1`
  - verify_jwt: `false`
  - import_map: `false`
- `file-rename`
  - status: `ACTIVE`
  - version: `1`
  - verify_jwt: `false`
  - import_map: `false`

Preflight verification:

```powershell
Invoke-WebRequest -Method Options -Uri "https://zuoejigurotylrcisycw.supabase.co/functions/v1/file-upload" -Headers @{ Origin = "http://localhost:3000"; "Access-Control-Request-Method" = "POST"; "Access-Control-Request-Headers" = "authorization,apikey" } -UseBasicParsing
```

Result:

```text
StatusCode: 200
Content: ok
Access-Control-Allow-Origin: *
```

POST verification with fake token:

```powershell
Invoke-WebRequest -Method Post -Uri "https://zuoejigurotylrcisycw.supabase.co/functions/v1/file-upload" -Headers @{ Authorization = "Bearer invalid"; apikey = "invalid"; Origin = "http://localhost:3000" } -UseBasicParsing
```

Result:

```json
{ "stage": "session_invalid" }
```

This confirms the deployed function is reachable and responding at least for non-multipart POST.

## Local Verification Already Run

Passed:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
deno check --node-modules-dir=auto supabase/functions/file-upload/index.ts
deno check --node-modules-dir=auto supabase/functions/file-rename/index.ts
deno check --node-modules-dir=auto supabase/functions/line-webhook/index.ts
```

Notes:

- Deno check may create `deno.lock` at repo root; it was removed after checks because it is generated noise.
- `npm run build` route output still shows many dynamic routes, expected.
- Build warning:

```text
Next.js ignored pnpm-workspace.yaml in D:\00_SourceCode\00_AI_App because it is outside the current Git repository
```

This warning existed during build and is likely not related to upload OCR.

## Current Git Working Tree

As of the last status check, the tree has many uncommitted changes from this session and previous UI work:

```text
 M eslint.config.mjs
 M package-lock.json
 M package.json
 M src/app/globals.css
 M src/components/calendar/CalendarView.tsx
 M src/components/files/FileDetailModal.tsx
 M src/components/files/LockerView.tsx
 M src/components/home/HomeView.tsx
 M src/components/providers/FilesProvider.tsx
 M src/components/shell/DesktopTopNav.tsx
 M src/components/shell/MobileBottomNav.tsx
 M src/components/tasks/TasksView.tsx
 M supabase/config.toml
 M supabase/functions/_shared/drive.ts
 M supabase/functions/line-webhook/index.ts
?? public/
?? src/app/calendar/loading.tsx
?? src/app/loading.tsx
?? src/app/locker/loading.tsx
?? src/app/settings/loading.tsx
?? src/app/tasks/loading.tsx
?? src/components/files/FileCard.tsx
?? src/components/files/ImageOcrUploader.tsx
?? src/components/ui/LinkPendingHint.tsx
?? src/components/ui/Skeletons.tsx
?? src/lib/ocr-filename.test.ts
?? src/lib/ocr-filename.ts
?? supabase/functions/file-rename/
?? supabase/functions/file-upload/
?? supabase/migrations/20260907090000_web_image_upload.sql
?? supabase/migrations/20260907091000_web_file_rename.sql
?? vercel.json
```

`handoff.md` itself will also be untracked after this file is created.

Do not blindly revert uncommitted changes; many are intentional.

## Files Most Relevant To The Current Upload OCR Bug

Frontend:

- `src/components/files/ImageOcrUploader.tsx`
- `src/lib/ocr-filename.ts`
- `src/lib/supabase/config.ts`
- `src/lib/supabase/client.ts`
- `src/components/files/LockerView.tsx`
- `src/components/providers/FilesProvider.tsx`
- `src/components/providers/ToastProvider.tsx`

Backend:

- `supabase/functions/file-upload/index.ts`
- `supabase/functions/_shared/drive.ts`
- `supabase/migrations/20260907090000_web_image_upload.sql`
- `supabase/config.toml`

Rename:

- `src/components/files/FileDetailModal.tsx`
- `supabase/functions/file-rename/index.ts`
- `supabase/migrations/20260907091000_web_file_rename.sql`

LINE:

- `supabase/functions/line-webhook/index.ts`

## Current `file-upload` Function Shape

The deployed function currently:

- imports Supabase with:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
```

- has CORS:

```ts
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
```

- handles:

```ts
if (req.method === "OPTIONS") {
  return new Response("ok", { status: 200, headers: CORS_HEADERS });
}
```

- validates bearer token with:

```ts
admin.auth.getUser(token)
```

- accepts only image files and max 5 MB.
- resolves workspace server-side.
- uploads to Google Drive using backend secrets.
- persists metadata with `create_file_from_web_upload`.

Known returned stages:

- `bad_method`
- `drive_not_configured`
- `no_token`
- `session_invalid`
- `bad_form`
- `no_file`
- `not_image`
- `too_big`
- `workspace_not_found`
- `drive_reauth`
- `drive_upload_failed`
- `metadata_failed`
- `already_saved`
- `ok`

## Next Debug Steps For The Remaining Upload Error

Ask the user for the current Network tab entry after a hard reload, or inspect locally if browser automation is available.

Important details to capture:

- Request URL.
- Request method (`OPTIONS` or `POST`).
- Status code.
- Response body.
- Response headers, especially:
  - `access-control-allow-origin`
  - `x-fk-stage`
- Whether the failing request is actually to `file-upload` in project `zuoejigurotylrcisycw`.
- Whether `.env.local` points `NEXT_PUBLIC_SUPABASE_URL` to the same project.

Suggested browser-side checks:

1. Hard reload local app.
2. Stop and restart `npm run dev` so `ImageOcrUploader.tsx` is not stale.
3. Disable the Chrome extension shown in stack traces if necessary:

```text
chrome-extension://dbjbempljhcmhlfpfacalomonjpalpko/scripts/inspector.js
```

4. Retry upload with a small PNG/JPG under 5 MB.
5. In DevTools Network, filter `file-upload`.

If Network shows a JSON response with `stage`, handle that stage directly.

If Network still shows `(failed)` with no response:

- compare browser's exact `Access-Control-Request-Headers` with allowed headers.
- test that exact preflight header list with `Invoke-WebRequest`.
- consider using a Next.js same-origin API proxy to call Supabase Edge Function server-side. This would avoid browser CORS entirely while still keeping OCR local and keeping secrets out of browser. The browser would post file bytes to the Next app after OCR and filename confirmation, then Next would forward to Supabase/Drive. Evaluate whether that changes the intended architecture before implementing.

If Network shows `drive_not_configured`:

- verify Supabase Edge secrets:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
  - `GOOGLE_DRIVE_FOLDER_ID`

If Network shows `drive_reauth`:

- Google refresh token is dead/revoked. Re-consent and update `GOOGLE_REFRESH_TOKEN`.

If Network shows `metadata_failed`:

- inspect Supabase function logs for `create_file_from_web_upload`.
- verify migrations were applied to the same remote project.
- verify `create_file_from_web_upload` exists and grants execute to `service_role`.

If Network shows `workspace_not_found`:

- verify logged-in user has a private workspace or family membership.
- inspect `resolveWorkspace()` logic in `file-upload`.

## Deployment Notes

Frontend changes are local/uncommitted unless the user later commits/pushes.

Supabase DB migrations and Edge Functions have already been pushed/deployed to remote project `zuoejigurotylrcisycw`.

If another LLM changes Edge Functions:

```powershell
npx supabase functions deploy file-upload --no-verify-jwt
npx supabase functions deploy file-rename --no-verify-jwt
```

If another migration is added:

```powershell
npx supabase db push
```

If frontend is ready for production:

```powershell
git add -A
git commit -m "<message>"
git push
```

Vercel should deploy from GitHub after push.

## Commands That Were Useful

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
deno check --node-modules-dir=auto supabase/functions/file-upload/index.ts
deno check --node-modules-dir=auto supabase/functions/file-rename/index.ts
npx supabase db push
npx supabase functions deploy file-upload --no-verify-jwt
npx supabase functions deploy file-rename --no-verify-jwt
npx supabase functions list
```

Remote CORS check:

```powershell
Invoke-WebRequest -Method Options -Uri "https://zuoejigurotylrcisycw.supabase.co/functions/v1/file-upload" -Headers @{ Origin = "http://localhost:3000"; "Access-Control-Request-Method" = "POST"; "Access-Control-Request-Headers" = "authorization,apikey" } -UseBasicParsing
```

Remote POST reachability check:

```powershell
Invoke-WebRequest -Method Post -Uri "https://zuoejigurotylrcisycw.supabase.co/functions/v1/file-upload" -Headers @{ Authorization = "Bearer invalid"; apikey = "invalid"; Origin = "http://localhost:3000" } -UseBasicParsing
```

## Do Not Forget

- The user's latest goal is not finished because upload OCR still errors in browser.
- The next person should start from the real current browser Network details, not from the old screenshot alone.
- Keep OCR offline. Do not add a cloud OCR API.
- Keep Google Drive upload server-side only.
- Do not expose Drive IDs or secrets to browser.
