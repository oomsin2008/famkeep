# Handoff: บ้านเรา — Warm Family Workspace

## Overview
A family-oriented workspace web app (Thai-first, mobile-first) connected to LINE. Users manage a personal ("ของฉัน") and a shared family ("ครอบครัว") context across four areas: Home, File Locker, Tasks, and Calendar, plus Settings. This package documents the approved visual system and the interactive prototype that demonstrates all flows and states.

## About the Design Files
The bundled `.dc.html` files are **design references built in HTML**, not production code. They render live in a browser (open directly) to show exact look, spacing, and interaction behavior — the target codebase's actual rendering (React components, Tailwind classes, shadcn primitives) should be built fresh using its own patterns, using these files as the pixel/behavior reference, not copy-pasted.

## Fidelity
**High-fidelity.** Colors, type scale, spacing, copy, and interaction states shown are final/locked (see Design Tokens below). Recreate pixel-accurately.

## Files in this bundle
- `Warm Family Workspace - Design System.dc.html` — locked visual system (source of truth for tokens).
- `Family Workspace Directions.dc.html` — approved static screen comps (2a Home/Locker, 3a Tasks/Detail/Calendar/Settings).
- `Warm Family Workspace - Prototype.dc.html` — interactive prototype implementing all flows/states described below (open in a browser; use the "เดสก์ท็อป/มือถือ" toggle in the black top bar to switch device views — that bar is a prototype-only tool, not part of the product).

---

## 1. App Structure

### Screens
| Screen | Purpose |
|---|---|
| Home | Daily overview: upcoming tasks (mixed private+family), recent files, LINE tip card |
| File Locker | Browse files, tabbed by workspace (ของฉัน / ครอบครัว) |
| Tasks | List all tasks, filterable (ทั้งหมด / ของฉัน / ครอบครัว) |
| Task Detail | View/edit one task: status, due date, reminders, assignee, notes |
| Create Task | New task form |
| Calendar | Month grid (desktop) / week strip + agenda (mobile); date → day's tasks → task detail |
| Settings | Profile, family members, LINE connection, notifications |
| File Detail (modal) | Overlay from Locker or Home file rows |

### Navigation model
- **Desktop**: persistent top bar — logo (home link) · หน้าหลัก · คลังไฟล์ · งาน · ปฏิทิน · search icon (decorative, not implemented) · avatar (→ Settings). Active item gets a 2px underline in the current **context color** (see §4).
- **Mobile**: bottom tab bar, 4 items (หน้าหลัก / คลังไฟล์ / งาน / ปฏิทิน), icon+label, hidden on Task Detail, Create Task, and Settings sub-screens (which use a back-arrow header instead). Settings root and top-level screens use a plain header (logo/title + search + avatar).
- Task Detail remembers its origin screen (`tasks` or `calendar`) so the back arrow returns correctly.
- Settings uses a **tab model on desktop** (left sidebar: ทั่วไป / ครอบครัว / การเชื่อมต่อ LINE / การแจ้งเตือน) and a **drill-down list on mobile** (tap a row → sub-screen with back arrow).

### Desktop vs Mobile behavior
- Desktop: two-column layouts (Home, Task Detail, Create Task), a data table for Locker, a full month grid for Calendar, a sidebar for Settings.
- Mobile: single-column stacked layouts, native `<select>`/date/time inputs full-width, Locker as a row list (no table), Calendar as a horizontal day strip + agenda list, Settings as a list menu.
- Nothing is "just shrunk" — mobile has its own layout per screen, per the design system's mobile-first rule.

---

## 2. Design Tokens

### Colors — Neutrals
| Token | Hex | Use |
|---|---|---|
| bg | `#F3F1E7` | app background |
| surface | `#FFFDF8` | cards/panels/app shell |
| surface-muted | `#FAF9F5` | subtle fills (e.g. today cell, dropdown bg) |
| text | `#101820` | primary text |
| text-2 | `#6B6A63` | secondary text |
| divider/border | `#EFEDE6` | all hairline rules |

### Private / Family workspace colors (context — ownership only, never status)
| Token | Hex | Tint | Hover | Press |
|---|---|---|---|---|
| Private (ของฉัน) | `#7FB9DE` | `#E8F2F9` | `#6A9EC9` | `#5883B4` |
| Family (ครอบครัว) | `#F28A45` | `#FDF0E8` | `#D67635` | `#B95E2B` |

Rule: used only for file icons, active-tab underline/text, context-bound primary buttons, and the workspace pill on a task. Never used as a card or page background fill.

### Task status colors (semantic — always paired with a label, never color-only)
| Status | Text | Background | Border |
|---|---|---|---|
| กำลังทำ (progress) | `#1D4ED8` | `#DBEAFE` | `#93C5FD` |
| ใกล้กำหนด (due soon) | `#B45309` | `#FEF3C7` | `#FCD34D` |
| เลยกำหนด (overdue) | `#B91C1C` | `#FEE2E2` | `#FCA5A5` |
| เสร็จแล้ว (done) | `#166534` | `#DCFCE7` | `#86EFAC` |
| ยกเลิก (cancelled) | `#4B5563` | `#F3F4F6` | `#D1D5DB` |

### Brand accents
- Primary yellow `#F6BE5C`, Coral orange `#F28A45`, Sky blue `#7FB9DE` — the brand triad.
- The only gradient in the whole system: `linear-gradient(135deg, #F6BE5C, #F28A45)`, reserved for the one "unbound" primary action — **สร้างงานใหม่** (create task), on all screens/breakpoints. No other gradients anywhere.

### Typography
- Single family: **Source Serif 4** (headings and body both — weight/size carries hierarchy, not a second face).
- Scale in use: H1 22–32px/600, H5 15–16px/600 (section labels), body 13.5–15px/400, meta/caption 11.5–12.5px/400–600 at reduced opacity (.5–.65).
- Never below 12px for any real content; status pill text sits at 12–12.5px/600 as the practical floor.

### Spacing & radius
- Spacing is loosely on an 8px-ish rhythm as used (6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 30, 32, 40, 44px) — implement as a Tailwind spacing scale rather than literal px if the codebase prefers tokens.
- Radius: **one canonical value, 8px** — applies to modals/dialogs, inputs, buttons, dropdowns, and cards. Pills/chips/badges use `border-radius: 999px` (full pill). No large "radius-lg" anywhere on product screens. Note: the HTML prototype's file-detail modal currently renders at 12px — that is a prototype inconsistency, not the design-system rule; implement the modal at 8px.
- Rows (task rows, file rows) are separated by a 1px `#EFEDE6` divider, not by card boxes/shadows.

### Borders & shadows
- Inputs, dropdowns, buttons (secondary/ghost): `1px solid #EFEDE6`.
- Only two shadows in the whole system: the mobile phone-frame outline (`0 0 0 1px var(--divider)`) and the FAB drop shadow (`0 4px 10px rgba(0,0,0,.18)`). No card elevation shadows — cards are "earned" (LINE tip box, file-detail modal) and even then styled with a tint fill, not a shadow.

---

## 3. Component Inventory

- **Top navigation (desktop)** — logo/home, 4 text links, active link gets 2px bottom border in context color, search icon (static), avatar circle (initials, priv-tint bg) → Settings.
- **Bottom navigation (mobile)** — 4 icon+label items, ≥44px tap height, active item colored in context color + bold label.
- **Workspace tabs** (ของฉัน / ครอบครัว) — plain text tabs with colored underline (desktop) or full-width equal-split tabs with underline (mobile). Used in Locker and Tasks-filter (Tasks uses ทั้งหมด/ของฉัน/ครอบครัว, 3-way).
- **Task row** — title (600/15px) + subtitle (owner/assignee, 12px/.55 opacity) + status pill, right-aligned; divider below; entire row clickable.
- **Task status badge/pill** — see token table; `padding:3px 9px;border-radius:6px;font:600 12px`.
- **File row** — type icon (colored by context) + filename (600/13.5-14px) + meta line (owner · date · size); desktop Locker uses a 4-column table; mobile/Home use a plain row.
- **File detail modal** — centered overlay (backdrop `rgba(16,24,32,.45)`), icon, filename, workspace pill, striped placeholder preview box (diagonal-stripe pattern, monospace caption), meta line, ดาวน์โหลด (primary, decorative — not wired) + ปิด (secondary) buttons. Backdrop click or X closes.
- **Task detail form** — two-column (desktop) / stacked (mobile): title (read-style box), notes box, reminders (chips + add), workspace pill (read-only), status pill (read-only), assignee, due date (view row with pencil-to-edit → date+time inputs + inline Save/Cancel).
- **Create task form** — title input*, description textarea, reminders (chips + add, hard cap 2), workspace picker* (two pills, single-select), conditional assignee `<select>` (family only), due date+time inputs*, per-field inline errors, Save (brand-gradient) + Cancel.
- **Reminder picker** — dashed-outline "+ เพิ่มการแจ้งเตือน" chip opens a small dropdown listing whichever of the 3 presets (1 day before / 3 hours before / 09:00 same day) aren't yet active, plus a "ปิด" close row; dismisses on outside click too. The add chip itself hides/disables once 2 reminders are active — a task never holds more than 2 at once.
- **Calendar (desktop)** — month title with ‹ › nav, 7-col grid, today = inset ring, selected = tinted fill, up to 2 task chips per cell (truncated label), day-detail panel below listing that date's tasks (or empty state).
- **Calendar (mobile)** — month/year label with ‹ › week nav, 7-day horizontal strip (same today/selected treatment), day-detail panel, "กำลังจะถึง" (upcoming, next 2) list below.
- **Settings sections** — ทั่วไป (profile + notification toggles), ครอบครัว (member list w/ role), การเชื่อมต่อ LINE (connection status card), การแจ้งเตือน (toggles). Desktop = sidebar; mobile = menu list → sub-screen.
- **Toast** — bottom-centered pill, green (success) or red (error), auto-dismiss ~2.2s.
- **Loading / disabled button state** — button fill turns to `#EFEDE6`/`#6B6A63` text, cursor not-allowed, label swaps to "กำลังบันทึก…".

---

## 4. Interaction Rules

- **Private/Family context**: color-codes ownership only (icons, tab underline, pills). Never used for status. A screen's nav-underline color follows the active workspace tab when inside Locker; defaults to Private blue elsewhere.
- **Locker deep-link behavior**: opening a file's detail (from Home or Locker) sets the Locker's active tab to match that file's workspace, so navigating into Locker afterward lands on the right tab. The generic "ดูคลังไฟล์" link keeps the last-used/default tab (ของฉัน) when there's no specific file context.
- **Task creation flow**: title, workspace, due date are required — errors are field-specific and inline (not one bundled banner). Selecting Family reveals an assignee select (defaults "ทุกคน"); Private auto-assigns "ตัวเอง". Due date cannot be in the past (inline error). Save → loading (~800ms) → success (button label "บันทึกแล้ว ✓" + toast) → returns to Tasks list with the new task at top, filter reset to "ทั้งหมด".
- **Max 2 reminders (hard limit)**: each task supports **0–2 reminders only**. The reminder picker must hide/disable the "+ เพิ่มการแจ้งเตือน" control once 2 reminders exist, at both the UI level (disable/hide the add affordance) and the backend/validation level (reject a 3rd reminder server-side). The 3 preset options (1 day before / 3 hrs before / 09:00 same day) remain the selectable pool, but only 2 may be active per task at once.
- **Due-date editing** (Task Detail): pencil icon (44×44 tap target, subtle/no visible button chrome) toggles inline date+time inputs with Save/Cancel. Save validates non-past date inline; loading (~700ms) → success toast, reverts to view mode.
- **Calendar navigation**: desktop ‹ › move by month; mobile ‹ › move by week (7 days). Selecting a date syncs both (so switching device mid-session stays coherent). Today and the selected date are visually distinct (today = colored inset ring; selected = filled tint) and can combine.
- **Mobile FAB**: create-task "+" button is positioned `absolute` within the mobile app frame (not viewport-fixed), bottom-right, clear of the bottom nav; task list content reserves bottom padding so the last row is never hidden behind it.

## 5. Responsive Rules
- Single breakpoint model in this prototype: **desktop** (fixed 1080px content column) vs **mobile** (fixed ~390px phone-frame column, centered). Implement as a real responsive breakpoint (e.g. `md:`) in production rather than a device toggle — the toggle exists only for prototype review.
- Mobile layout is authored independently per screen (not a squeeze of desktop) — see §1.
- **Touch targets**: production implementation must ensure all primary interactive controls on mobile have a minimum 44×44px touch target. Pay particular attention to: back buttons, edit icons (e.g. due-date pencil), reminder remove (×) actions, calendar previous/next controls, bottom navigation items, and the FAB. Do not assume the HTML prototype already satisfies this everywhere — audit each of these controls during implementation rather than copying the prototype's exact hit-area sizing.

## 6. State Checklist
| State | Where shown |
|---|---|
| Default | all rows/pills/tabs at rest |
| Hover | not modeled in the HTML prototype (touch-first); add desktop `:hover` affordances (underline/opacity shift) in implementation |
| Selected | active nav item, active workspace tab, active task filter, selected calendar date, chosen workspace pill in Create Task |
| Disabled | "แก้ไขโปรไฟล์", "ยกเลิกการเชื่อมต่อ", "ออกจากระบบ" — all explicitly out of scope for this prototype, shown at .4 opacity + not-allowed cursor with a tooltip explaining why |
| Loading | Save button (due-date edit and create-task) — muted fill, "กำลังบันทึก…" label, disabled |
| Success | Save → toast (green) + revert/redirect; Create Task button shows "บันทึกแล้ว ✓" momentarily |
| Error | inline red text + warning icon under the specific invalid field (past due date, missing title/workspace/date) — red token `#B91C1C` text on `#FEE2E2` tint where boxed |
| Empty | "ไม่มีงานในหมวดนี้" (Tasks filter), "ไม่มีงานในวันนี้" (Calendar day panel, with a coffee icon) |

---

## 7. Implementation Notes for Claude Code

**Stack mapping**: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.

- **Design tokens → `tailwind.config.ts`**: add `priv`/`priv-tint`/`fam`/`fam-tint` and the 5 status color pairs as custom colors; set the single radius (`rounded-lg` ≈ 8px) as the project default; keep the brand gradient as a Tailwind `bg-gradient-to-br from-[#F6BE5C] to-[#F28A45]` utility, used in exactly one place (create-task CTA).
- **Font**: load Source Serif 4 via `next/font/google`; apply as the sole `font-family` (no secondary sans face).
- **Routing**: `/`, `/locker`, `/tasks`, `/tasks/[id]`, `/tasks/new`, `/calendar`, `/settings` (+ `/settings/family`, `/settings/line`, `/settings/notifications` as nested routes or client-side sub-state — the prototype treats Settings sub-screens as client state on mobile, which maps fine to nested routes for shareable URLs).
- **Components with shadcn primitives**: `Tabs` (workspace/task filter tabs — restyle to match plain-text+underline, not the boxed default), `Dialog` (file detail modal), `Popover` (reminder picker, wired to close-on-outside-click natively), `Select` (assignee), `Input`/`Textarea`, `Toast` (sonner or shadcn toast, styled to the two color states), `Switch` (notification toggles, already close to the design's pill switch).
- **Calendar**: no shadcn calendar primitive matches this layout closely enough (custom status dots per day, day-detail panel) — build a custom grid component; consider `date-fns` for month/week math (mirrors the prototype's own date arithmetic).
- **State/data**: the prototype's local React state (`tasks`, `createForm`, `selectedDate`, etc.) maps directly to a real data layer — replace in-memory arrays with actual fetch/mutation (e.g. Server Actions or a query lib), keeping the same field-specific validation and optimistic loading/success/error states.
- **Reminder cap correction**: the current HTML prototype allows up to 3 reminders — this is a prototype inconsistency, not the product rule. Production must enforce the hard 2-reminder maximum described above.

## Assets
No custom icons/images — all icons are Phosphor Icons (Duotone set, `@phosphor-icons/web`). No photography/imagery is used; the file-detail preview is a generic striped placeholder (real thumbnails are a future addition, not designed yet).
