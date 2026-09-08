# KitiButler UI Redesign v2 — Claymorphism + Glassmorphism Design System

## 1. Design Direction

KitiButler v2 ใช้แนวทางภาพแบบ:

- 3D claymorphism
- soft glassmorphism
- pastel family-friendly interface
- minimal modern dashboard
- warm cream background
- rounded tactile cards
- soft shadows
- clean Thai-first productivity UI

เป้าหมายคือทำให้ KitiButler ดู:
- อบอุ่น
- เป็นมิตรกับครอบครัว
- พรีเมียม
- ใช้ง่าย
- น่าเชื่อถือ
- ไม่เป็น technical dashboard จนเกินไป

ภาพรวมจาก reference:
- พื้นหลังหลักเป็นครีมอุ่น
- การ์ดเป็นขาว/ครีมแบบโปร่งนิด ๆ
- ปุ่มหลักเป็น blue gradient
- ปุ่ม success เป็นเขียว
- ปุ่ม danger เป็น coral/red
- status badge ใช้สี pastel
- มี 3D clay icon/illustration สำหรับ empty state, mascot, navigation, file/task/calendar/reminder

ห้ามเปลี่ยน business logic ของแอป  
เน้นเปลี่ยนเฉพาะ UI, component styling, spacing, hierarchy และ visual polish

---

## 2. Color Tokens

> สีด้านล่างอ้างอิงจากภาพ redesign และปรับให้นำไปใช้จริงใน Tailwind ได้ง่าย

### Brand / Base

```css
--fk-bg: #fff6ee;
--fk-bg-soft: #f8efe5;
--fk-surface: #fffaf4;
--fk-surface-glass: rgba(255, 255, 255, 0.72);
--fk-surface-strong: #ffffff;
--fk-border: #eadfD2;
--fk-border-soft: rgba(120, 88, 56, 0.12);

--fk-text: #3a3a3a;
--fk-text-muted: #686868;
--fk-text-soft: #9a8f84;

--fk-brand-brown: #8a5a32;
--fk-brand-cream: #fff6ee;
--fk-brand-beige: #f7e6d2;
--fk-brand-peach: #ffdcc2;
--fk-brand-blue: #bfd6f6;
--fk-brand-green: #cfe3d4;
--fk-brand-gray: #e9e1d8;
Action Colors
--fk-primary: #5f9bea;
--fk-primary-strong: #3f7fd8;
--fk-primary-soft: #e8f2ff;

--fk-success: #78c894;
--fk-success-strong: #42a96b;
--fk-success-soft: #e8f8ec;

--fk-warning: #f6c85f;
--fk-warning-strong: #f0a72f;
--fk-warning-soft: #fff3cf;

--fk-danger: #ff7f66;
--fk-danger-strong: #e95f48;
--fk-danger-soft: #ffe3dc;

--fk-line: #4cc764;
--fk-line-soft: #e5f8ea;
Workspace Colors
--fk-private: #7fb9de;
--fk-private-soft: #e8f2f9;

--fk-family: #f28a45;
--fk-family-soft: #fdf0e8;
Status Colors
--fk-status-due-soon-text: #b87512;
--fk-status-due-soon-bg: #fff0bd;
--fk-status-due-soon-border: #ffd979;

--fk-status-overdue-text: #d94c3d;
--fk-status-overdue-bg: #ffe0d8;
--fk-status-overdue-border: #ffad9f;

--fk-status-done-text: #388b4f;
--fk-status-done-bg: #dff5e5;
--fk-status-done-border: #a9dfb7;

--fk-status-progress-text: #3f7fd8;
--fk-status-progress-bg: #e8f2ff;
--fk-status-progress-border: #bfd6f6;

--fk-status-cancelled-text: #686868;
--fk-status-cancelled-bg: #eee8df;
--fk-status-cancelled-border: #d8cec2;
3. Tailwind v4 Token Implementation
ให้ใช้ CSS-first Tailwind v4 ใน src/app/globals.css
@theme {
  --color-fk-bg: #fff6ee;
  --color-fk-bg-soft: #f8efe5;
  --color-fk-surface: #fffaf4;
  --color-fk-surface-strong: #ffffff;
  --color-fk-border: #eadfd2;
  --color-fk-text: #3a3a3a;
  --color-fk-muted: #686868;

  --color-fk-primary: #5f9bea;
  --color-fk-primary-strong: #3f7fd8;
  --color-fk-primary-soft: #e8f2ff;

  --color-fk-success: #78c894;
  --color-fk-warning: #f6c85f;
  --color-fk-danger: #ff7f66;
  --color-fk-line: #4cc764;

  --radius-fk-sm: 10px;
  --radius-fk-md: 16px;
  --radius-fk-lg: 24px;
  --radius-fk-xl: 32px;
  --radius-fk-pill: 999px;
}
4. Typography
ภาพ redesign ใช้ตัวอักษรแนว rounded, friendly, readable
ให้ใช้ font เดิมของโปรเจกต์ได้ แต่ปรับ hierarchy:
H1 / Page title:
32px / 40px / semibold

H2 / Section title:
24px / 32px / semibold

H3 / Card title:
18px / 24px / semibold

Body:
16px / 24px / regular

Caption:
14px / 20px / regular

Micro label:
12px / 16px / medium
Thai Typography Rules
- ใช้ Thai label จริงทั้งหมด
- หลีกเลี่ยง text เล็กกว่า 12px
- Form label ใช้ 14px medium
- Status badge ใช้ 13–14px
- Task/File row title ใช้ 15–16px semibold
- Secondary metadata ใช้ 13–14px muted
5. Spacing System
ใช้ระบบ 4px grid
4px   = xs
8px   = sm
12px  = md
16px  = base
20px  = lg
24px  = xl
32px  = 2xl
40px  = 3xl
48px  = 4xl
64px  = section
Layout Spacing
Page max width desktop: 1180px–1280px
Main page padding desktop: 32px
Main page padding tablet: 24px
Main page padding mobile: 16px

Card inner padding:
small card: 16px
normal card: 20px–24px
large panel: 28px–32px

Row height:
task row: 64–76px
file row: 60–72px
mobile touch target: minimum 44px
6. Radius
Claymorphism ต้องดูนุ่มและจับต้องได้
Small controls: 10px
Input: 14px
Button: 14px–16px
Card: 20px–24px
Large panel/modal: 28px–32px
Avatar: 999px
Badge/pill/chip: 999px
3D object container: 28px+
7. Shadows
ใช้ shadow แบบ soft, warm, low contrast
--fk-shadow-soft:
  0 8px 24px rgba(96, 72, 48, 0.08),
  0 2px 8px rgba(96, 72, 48, 0.04);

--fk-shadow-card:
  0 14px 36px rgba(96, 72, 48, 0.10),
  inset 0 1px 0 rgba(255, 255, 255, 0.7);

--fk-shadow-floating:
  0 24px 60px rgba(96, 72, 48, 0.18);

--fk-shadow-button:
  0 8px 18px rgba(63, 127, 216, 0.25);
Shadow Rules
- ห้ามใช้ shadow ดำแข็ง
- shadow ต้องเป็น brown/warm gray alpha
- card hover ยกขึ้นเล็กน้อย
- button hover มี translateY(-1px)
- modal ใช้ shadow floating
8. Glassmorphism Rules
ใช้กับ:
- top navigation
- dashboard panels
- settings cards
- modal surface
- floating summary cards
.fk-glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.62);
  box-shadow: var(--fk-shadow-card);
}
ข้อควรระวัง:
- อย่าใส่ blur หนักในทุก component
- ตาราง/list ควรอ่านง่ายก่อน
- พื้นที่ที่มีข้อมูลเยอะให้ใช้ surface ทึบมากกว่า glass
9. Claymorphism Rules
ใช้กับ:
- icon cards
- empty states
- family illustration
- file/task/calendar/reminder icons
- mascot
- LINE bot card
ลักษณะ:
- object กลมมน
- pastel material
- highlight ด้านบนซ้าย
- shadow ด้านล่างขวา
- ไม่มีเส้นแข็ง
- ดูเหมือนดินปั้น 3D
Implementation ในโค้ด:
- ใช้ icon + rounded gradient background แทน 3D จริงก่อน
- ถ้ามี asset 3D ภายหลัง ให้ใส่ใน public/illustrations/
- ห้ามให้ภาพ 3D ทำให้ loading หนักเกิน
ตัวอย่าง component:
<div className="rounded-[24px] bg-gradient-to-br from-white to-[#f7e6d2] shadow-[0_14px_36px_rgba(96,72,48,0.12)]">
  ...
</div>
10. Buttons
Primary Button
ใช้กับ action หลัก:
- บันทึกงาน
- สร้างงานใหม่
- อัปโหลดไฟล์
- อนุมัติกลุ่มนี้
Style:
background: blue gradient
text: white
radius: 14–16px
height: 44–48px
shadow: soft blue
hover: slightly brighter + lift
Example classes:
className="
  inline-flex min-h-11 items-center justify-center rounded-2xl
  bg-gradient-to-b from-[#6ba8f4] to-[#3f7fd8]
  px-5 font-medium text-white
  shadow-[0_8px_18px_rgba(63,127,216,0.25)]
  transition hover:-translate-y-0.5 hover:brightness-105
"
Secondary Button
ใช้กับ:
- ยกเลิก
- ดูรายละเอียด
- เปิดในแท็บใหม่
background: rgba white
border: warm beige
text: #3a3a3a
radius: 14–16px
Success Button
ใช้กับ:
- ทำเสร็จแล้ว
- เชื่อมต่อแล้ว
- ยืนยันสำเร็จ
background: pastel green / green gradient
Danger Button
ใช้กับ:
- ลบไฟล์
- ลบงาน
- ยกเลิกการเชื่อมต่อ
background: coral/red gradient
text: white
confirm before destructive action
Icon Button
size: 40–44px
radius: 999px or 14px
background: glass surface
hover: soft highlight
11. Inputs / Forms
Text Input
height: 44–48px
background: white / glass white
border: #eadfd2
radius: 14px
padding: 12px 16px
focus: blue ring
Textarea
min-height: 112px
same style as input
resize allowed vertical only
Select / Date / Time
same base input style
icon aligned right
focus visible
Form Layout
Desktop:
- two-column layout for create task
- left = title/notes/reminders
- right = workspace/date/time/actions
Mobile:
- single column
- sticky/floating save action optional
12. Cards
Base Card
background: glass white / warm white
border: soft white + beige
radius: 24px
padding: 20–24px
shadow: soft card
Dashboard Summary Card
ใช้กับ:
- งานทั้งหมด
- งานครอบครัว
- ใกล้กำหนด
- ไฟล์ล่าสุด
ควรมี:
- 3D icon
- number ใหญ่
- label
- small caption
Content Card
ใช้กับ:
- task detail
- family settings
- LINE settings
- file preview
ควรดูสะอาด อ่านง่าย ไม่ใส่ decorative เยอะเกิน
13. Status Badges
ใช้ pill badge แบบ pastel
Due Soon
label: ใกล้กำหนด
bg: #fff0bd
text: #b87512
border: #ffd979
icon: clock
Overdue
label: เลยกำหนด
bg: #ffe0d8
text: #d94c3d
border: #ffad9f
icon: alert
Done
label: เสร็จแล้ว
bg: #dff5e5
text: #388b4f
border: #a9dfb7
icon: check
Progress/Open
label: รอดำเนินการ
bg: #e8f2ff
text: #3f7fd8
border: #bfd6f6
icon: dot/clock
Badge text should support date + time:
ใกล้กำหนด · 4 ก.ย. 2569 18:00
เลยกำหนด · 3 ก.ย. 2569 13:10
เสร็จแล้ว · 3 ก.ย. 2569 13:10
14. Workspace Pills
Private
label: ของฉัน
bg: #e8f2f9
text: #3f7fa8
icon: user
Family
label: ครอบครัวสุขใจ
bg: #fdf0e8
text: #c76a2f
icon: users/family
Rules:
- workspace color is not status color
- use pill shape
- always visible in task/file rows
15. Task Rows
Task row style:
- white/glass rounded row
- subtle border
- 64–76px height
- hover lift/light glow
- left: checkbox/status icon + title + workspace
- right: due badge + chevron/menu
- mobile: stack due badge under title
Content example:
จ่ายค่าน้ำประปา
ครอบครัวสุขใจ · มอบหมายให้ พ่อ
ใกล้กำหนด · 4 ก.ย. 2569 18:00
Interaction:
- click row opens detail
- no accidental destructive actions
- status badge readable
- support keyboard focus
16. File Rows
File row style:
- rounded row or soft table row
- icon by type:
  - PDF = red document
  - image = blue image
  - document = orange/neutral document
- columns:
  - file name
  - date
  - size
  - uploader
  - menu/open action
Example:
ใบเสร็จค่าน้ำ.pdf
10 พ.ค. 2567 · 1.2 MB · คุณ
Sort controls:
- ชื่อไฟล์ A→Z
- ชื่อไฟล์ Z→A
- วันที่ ใหม่→เก่า
- วันที่ เก่า→ใหม่
- ขนาด ใหญ่→เล็ก
- ขนาด เล็ก→ใหญ่
17. Modal Styles
Modal:
background: white/glass
radius: 28–32px
shadow: floating
max width: 520–720px
padding: 24px
File modal:
- icon
- filename
- workspace pill
- preview area
- metadata
- action buttons:
  - ดาวน์โหลด
  - เปิดในแท็บใหม่
  - ลบไฟล์
  - ปิด
Delete confirmation modal:
- clear title: ยืนยันการลบไฟล์นี้?
- warning text
- secondary cancel
- danger confirm
18. Navigation
Top nav:
- glass bar
- logo left
- nav center/right
- profile avatar right
- active nav has blue underline/pill
- nav labels:
  - หน้าหลัก
  - คลังไฟล์
  - งาน
  - ปฏิทิน
Settings sidebar:
- rounded vertical nav
- active item blue soft background
- labels:
  - ทั่วไป
  - ครอบครัว
  - การเชื่อมต่อ LINE
  - การแจ้งเตือน
Mobile:
- bottom nav with icons
- minimum 44px touch target
- keep active state clear
19. Empty States
ใช้ 3D clay illustration:
- cloud + folder
- empty box
- friendly mascot
- small plant/cloud elements
Examples:
ยังไม่มีไฟล์ในพื้นที่นี้
เริ่มบันทึกไฟล์จาก LINE ได้เลย
ยังไม่มีงาน
สร้างงานใหม่ หรือส่ง #งาน ผ่าน LINE
Empty state should include one clear action button.
20. LINE Integration UI
LINE card:
- green LINE badge/icon
- bot connection status
- 1:1 connected state
- family group pending approval card
- command help:
  - #งาน — สร้างงานใหม่จากข้อความ
  - #เก็บ — บันทึกรูปเข้าคลัง
States:
เชื่อมต่อ LINE แล้ว
1:1 Bot ทำงานปกติ
กลุ่มรออนุมัติ
อนุมัติกลุ่มนี้
ยกเลิกการเชื่อมกลุ่ม
Style:
- LINE green only for LINE-specific cards
- use rounded glass panels
- optional small 3D bot mascot
21. Family Settings UI
Family card:
- family illustration/avatar group
- family name
- member count
- created date if available
Member list:
- avatar
- display name
- role badge:
  - เจ้าของ
  - สมาชิก
- action menu only for owner
Add member:
- input LINE ID
- button เพิ่มสมาชิก
- show helper text
- do not expose raw LINE ID unnecessarily after adding
22. Calendar UI
Calendar:
- large rounded glass panel
- month grid
- selected day blue circle
- today subtle ring
- task dots/chips by status
- right day panel shows tasks with time
Calendar labels:
พฤษภาคม 2567
วันนี้
งานวันนี้
รายการที่กำลังจะถึง
Task chip must show time where useful.
23. Responsive Rules
Desktop:
- dashboard max width 1180–1280px
- two-column or three-column cards
- settings uses sidebar + content panel
- calendar uses month grid + side panel
Tablet:
- reduce columns
- keep nav readable
- cards wrap naturally
Mobile:
- single column
- bottom navigation
- forms stacked
- modal nearly full width
- task/file rows stack metadata
- buttons min height 44px
- avoid tiny text
24. Implementation Notes for Next.js + Tailwind v4
Scope
Implement UI only.
Do not change:
- Supabase schema
- RLS
- RPCs
- LINE webhook
- Google Drive integration
- task/reminder/file business logic
- auth logic
Recommended Implementation Order
1. Update src/app/globals.css
   - theme tokens
   - body background
   - global card/button utility classes if needed
2. Create/revise reusable primitives:
   - Button
   - Card
   - Badge
   - WorkspacePill
   - Input
   - Modal
   - EmptyState
3. Update app shell:
   - top nav
   - mobile nav
   - settings sidebar
4. Update pages:
   - Home
   - Tasks list
   - Create Task
   - Task Detail
   - Calendar
   - Locker
   - File Modal
   - Settings / LINE / Family
5. QA:
   - responsive
   - keyboard focus
   - hover/focus states
   - no layout shift
   - Thai text readability
Suggested Utility Classes
.fk-card {
  background: rgba(255, 250, 244, 0.82);
  border: 1px solid rgba(234, 223, 210, 0.8);
  box-shadow:
    0 14px 36px rgba(96, 72, 48, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  border-radius: 24px;
}

.fk-glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.62);
}

.fk-soft-hover {
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.fk-soft-hover:hover {
  transform: translateY(-1px);
}
25. Acceptance Criteria
UI redesign is accepted when:
- all existing features still work
- no business logic changes
- production build passes
- UI resembles claymorphism/glassmorphism reference
- Thai labels are readable
- task/file/status information remains clear
- mobile layout remains usable
- no secrets or internal IDs are exposed
- Locker, Tasks, LINE Settings, Family Settings remain functional