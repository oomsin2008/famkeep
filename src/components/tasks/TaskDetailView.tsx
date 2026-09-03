"use client";

import { useState, useTransition } from "react";
import { CalendarBlank, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  bangkokDateKey,
  bangkokDateTimeToUtcIso,
  bangkokTimeKey,
  formatThaiDateTime,
} from "@/lib/datetime";
import { deriveTaskStatus } from "@/lib/tasks";
import {
  addTaskReminderAction,
  removeTaskReminderAction,
  setTaskAssigneeAction,
  setTaskDueAtAction,
  setTaskLifecycleAction,
  updateTaskFieldsAction,
} from "@/lib/task-actions";
import type { TaskFamilyMember } from "@/lib/task-repository";
import type { ReminderPreset, TaskLifecycleStatus, TaskView } from "@/lib/types";
import { WorkspacePill } from "./WorkspacePill";
import { ReminderPicker } from "./ReminderPicker";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "./presentation";

const boxClass =
  "w-full rounded-standard border border-border bg-surface px-3.5 py-2.5 text-sm shadow-soft outline-none transition-colors focus:border-primary";

function isPastBangkok(date: string, time: string): boolean {
  return new Date(bangkokDateTimeToUtcIso(date, time)).getTime() < Date.now();
}

/** Mount with `key={task.id}` so per-task edit drafts reset on navigation. */
export function TaskDetailView({
  task,
  familyMembers,
}: {
  task: TaskView;
  familyMembers: TaskFamilyMember[];
}) {
  const { now } = useTasks();
  const toast = useToast();

  const [titleDraft, setTitleDraft] = useState(task.title);
  const [notesDraft, setNotesDraft] = useState(task.notes);
  const [editingDue, setEditingDue] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("");
  const [dueError, setDueError] = useState("");
  const [savePending, startSave] = useTransition();
  const [duePending, startDue] = useTransition();

  if (!now) {
    return <div className="h-64 animate-pulse rounded-standard bg-surface-muted" />;
  }

  const openDerived = deriveTaskStatus(
    { dueAt: task.dueAt, lifecycleStatus: "open" },
    now,
  ) as "progress" | "duesoon" | "overdue";
  const isFamily = task.workspace === "family";

  const lifecycleOptions: {
    value: TaskLifecycleStatus;
    label: string;
    activeKey: keyof typeof STATUS_BADGE_CLASSES;
  }[] = [
    { value: "open", label: STATUS_LABELS[openDerived], activeKey: openDerived },
    { value: "done", label: "เสร็จแล้ว", activeKey: "done" },
    { value: "cancelled", label: "ยกเลิก", activeKey: "cancelled" },
  ];

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(task.title);
      return;
    }
    if (next === task.title) return;
    startSave(async () => {
      const result = await updateTaskFieldsAction(task.id, { title: next });
      if (!result.ok) {
        setTitleDraft(task.title);
        toast.show("error", result.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  };

  const commitNotes = () => {
    const next = notesDraft.trim();
    if (next === task.notes) return;
    startSave(async () => {
      const result = await updateTaskFieldsAction(task.id, { notes: next });
      if (!result.ok) {
        setNotesDraft(task.notes);
        toast.show("error", result.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  };

  const changeLifecycle = (status: TaskLifecycleStatus) => {
    if (status === task.lifecycleStatus) return;
    startSave(async () => {
      const result = await setTaskLifecycleAction(task.id, status);
      if (!result.ok) toast.show("error", result.error ?? "บันทึกไม่สำเร็จ");
    });
  };

  const changeAssignee = (value: string) => {
    startSave(async () => {
      const result = await setTaskAssigneeAction(task.id, value || null);
      if (!result.ok) toast.show("error", result.error ?? "บันทึกไม่สำเร็จ");
    });
  };

  const startEditDue = () => {
    setDateDraft(bangkokDateKey(task.dueAt));
    setTimeDraft(bangkokTimeKey(task.dueAt));
    setDueError("");
    setEditingDue(true);
  };

  const saveDue = () => {
    if (!dateDraft || !timeDraft) {
      setDueError("กรุณาเลือกวันและเวลา");
      return;
    }
    if (isPastBangkok(dateDraft, timeDraft)) {
      setDueError("กำหนดส่งต้องไม่ใช่เวลาที่ผ่านมาแล้ว");
      return;
    }
    startDue(async () => {
      const result = await setTaskDueAtAction(
        task.id,
        bangkokDateTimeToUtcIso(dateDraft, timeDraft),
      );
      if (!result.ok) {
        setDueError(result.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setEditingDue(false);
      toast.show("success", "บันทึกกำหนดวันแล้ว");
    });
  };

  const reminderPresets = task.reminders.map((r) => r.preset);

  const onAddReminder = (preset: ReminderPreset) => {
    startSave(async () => {
      const result = await addTaskReminderAction(task.id, preset);
      if (!result.ok) toast.show("error", result.error ?? "เพิ่มการแจ้งเตือนไม่สำเร็จ");
    });
  };
  const onRemoveReminder = (preset: ReminderPreset) => {
    startSave(async () => {
      const result = await removeTaskReminderAction(task.id, preset);
      if (!result.ok) toast.show("error", result.error ?? "ลบการแจ้งเตือนไม่สำเร็จ");
    });
  };

  return (
    <div className="md:max-w-[940px]">
      <h1 className="mb-6 hidden text-[28px] font-semibold md:block">รายละเอียดงาน</h1>

      <div className="fk-card flex flex-col gap-6 p-5 md:flex-row md:gap-10 md:p-7">
        {/* Left column */}
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <label htmlFor="task-detail-title" className="mb-1.5 block text-xs font-semibold text-text-2">
              ชื่องาน
            </label>
            <input
              id="task-detail-title"
              className={`${boxClass} font-semibold`}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
            />
          </div>

          <div>
            <label htmlFor="task-detail-notes" className="mb-1.5 block text-xs font-semibold text-text-2">
              รายละเอียดเพิ่มเติม
            </label>
            <textarea
              id="task-detail-notes"
              className={`${boxClass} min-h-20 resize-y leading-relaxed`}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
              rows={3}
              placeholder="ไม่มีรายละเอียดเพิ่มเติม"
            />
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-text-2">การแจ้งเตือน</div>
            <ReminderPicker
              value={reminderPresets}
              onAdd={onAddReminder}
              onRemove={onRemoveReminder}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5 md:w-72">
          <div>
            <div className="mb-2 text-xs font-semibold text-text-2">พื้นที่</div>
            <WorkspacePill workspace={task.workspace} familyName={task.workspaceName} />
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-text-2">สถานะ</div>
            <div className="flex flex-wrap gap-2">
              {lifecycleOptions.map((opt) => {
                const active = task.lifecycleStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => changeLifecycle(opt.value)}
                    disabled={savePending}
                    aria-pressed={active}
                    className={[
                      "min-h-11 rounded-pill border px-4 text-xs font-semibold disabled:cursor-not-allowed",
                      active
                        ? `${STATUS_BADGE_CLASSES[opt.activeKey]} shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]`
                        : "border-border bg-surface text-text-2 hover:text-text",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {isFamily ? (
              <label htmlFor="task-detail-assignee" className="mb-2 block text-xs font-semibold text-text-2">
                มอบหมายให้
              </label>
            ) : (
              <div className="mb-2 text-xs font-semibold text-text-2">มอบหมายให้</div>
            )}
            {isFamily ? (
              <select
                id="task-detail-assignee"
                className={boxClass}
                value={task.assigneeId ?? ""}
                disabled={savePending}
                onChange={(e) => changeAssignee(e.target.value)}
              >
                <option value="">ทุกคน</option>
                {familyMembers.map((m) => (
                  <option key={m.profileId} value={m.profileId}>
                    {m.displayName}
                  </option>
                ))}
                {task.assigneeId &&
                !familyMembers.some((m) => m.profileId === task.assigneeId) ? (
                  <option value={task.assigneeId}>
                    {task.assigneeName ?? "สมาชิกที่ออกจากครอบครัวแล้ว"}
                  </option>
                ) : null}
              </select>
            ) : (
              <div className="text-sm">ตัวเอง</div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-xs font-semibold text-text-2">
                กำหนดวันและเวลา
              </div>
              {!editingDue ? (
                <button
                  type="button"
                  onClick={startEditDue}
                  aria-label="แก้ไขกำหนดวันและเวลา"
                  className="-mr-2.5 -my-2 flex size-11 items-center justify-center rounded-standard text-text-2"
                >
                  <PencilSimple size={15} />
                </button>
              ) : null}
            </div>

            {!editingDue ? (
              <div className="flex items-center gap-2 rounded-standard border border-border bg-surface px-3.5 py-2.5 text-sm shadow-soft">
                <CalendarBlank size={16} className="text-primary-strong" />
                {formatThaiDateTime(task.dueAt)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="date"
                  aria-label="วันครบกำหนด"
                  className={`${boxClass} min-h-11`}
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                />
                <input
                  type="time"
                  aria-label="เวลา"
                  className={`${boxClass} min-h-11`}
                  value={timeDraft}
                  onChange={(e) => setTimeDraft(e.target.value)}
                />
                {dueError ? (
                  <div className="flex items-center gap-1.5 text-xs text-status-overdue-text">
                    <WarningCircle size={13} />
                    {dueError}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveDue}
                    disabled={duePending}
                    className={[
                      "fk-soft-hover min-h-11 rounded-standard px-4 text-sm font-semibold disabled:cursor-not-allowed",
                      duePending ? "bg-border text-text-2" : "fk-btn-primary",
                    ].join(" ")}
                  >
                    {duePending ? "กำลังบันทึก…" : "บันทึก"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDue(false);
                      setDueError("");
                    }}
                    disabled={duePending}
                    className="min-h-11 rounded-standard border border-border bg-surface-strong px-4 text-sm shadow-soft disabled:cursor-not-allowed"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
