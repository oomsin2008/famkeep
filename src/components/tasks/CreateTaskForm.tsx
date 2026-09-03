"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/components/providers/TasksProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  bangkokDateKey,
  bangkokDateTimeToUtcIso,
  bangkokTimeKey,
} from "@/lib/datetime";
import { MAX_TASK_REMINDERS } from "@/lib/tasks";
import { createTaskAction } from "@/lib/task-actions";
import type { TaskWorkspaceOptions } from "@/lib/task-repository";
import type { ReminderPreset, Workspace } from "@/lib/types";
import { FormField } from "@/components/ui/FormField";
import { ReminderPicker } from "./ReminderPicker";
import { workspaceLabel } from "./presentation";

interface FormState {
  title: string;
  description: string;
  workspace: Workspace | "";
  assigneeId: string; // "" = ทุกคน
  dueDate: string;
  dueTime: string;
  reminders: ReminderPreset[];
}

type FieldError = Partial<
  Record<"title" | "workspace" | "dueDate" | "dueTime" | "form", string>
>;

/** Default reminder for a new task: fire exactly at the due time. */
const DEFAULT_REMINDERS: ReminderPreset[] = ["at_due_time"];

/** Initial form: private workspace (if any), due = today + now (Asia/Bangkok). */
function makeInitialForm(workspaces: TaskWorkspaceOptions): FormState {
  const now = new Date();
  return {
    title: "",
    description: "",
    workspace: workspaces.privateWorkspaceId ? "private" : "",
    assigneeId: "",
    dueDate: bangkokDateKey(now),
    dueTime: bangkokTimeKey(now),
    reminders: DEFAULT_REMINDERS,
  };
}

const inputClass =
  "w-full rounded-standard border border-border bg-surface px-3.5 py-2.5 text-sm shadow-soft outline-none transition-colors focus:border-primary";

function validate(form: FormState): FieldError {
  const errors: FieldError = {};
  if (!form.title.trim()) errors.title = "กรุณากรอกชื่องาน";
  if (!form.workspace) errors.workspace = "กรุณาเลือกพื้นที่";
  if (!form.dueDate) errors.dueDate = "กรุณาเลือกวันครบกำหนด";
  if (!form.dueTime) errors.dueTime = "กรุณาเลือกเวลา";
  if (form.dueDate && form.dueTime) {
    const dueAt = new Date(bangkokDateTimeToUtcIso(form.dueDate, form.dueTime));
    // compare at minute resolution so a task due "now" (the default) is allowed
    if (Math.floor(dueAt.getTime() / 60000) < Math.floor(Date.now() / 60000)) {
      errors.dueDate = "กำหนดส่งต้องไม่ใช่เวลาที่ผ่านมาแล้ว";
    }
  }
  return errors;
}

export function CreateTaskForm({
  workspaces,
}: {
  workspaces: TaskWorkspaceOptions;
}) {
  const router = useRouter();
  const { setFilter } = useTasks();
  const toast = useToast();

  const [form, setForm] = useState<FormState>(() => makeInitialForm(workspaces));
  const [errors, setErrors] = useState<FieldError>({});
  const [pending, startTransition] = useTransition();

  const familyName = workspaces.family?.name;
  const availableWorkspaces: Workspace[] = [
    ...(workspaces.privateWorkspaceId ? (["private"] as const) : []),
    ...(workspaces.family ? (["family"] as const) : []),
  ];

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const isFamily = form.workspace === "family";

  const addReminder = (preset: ReminderPreset) => {
    setForm((prev) =>
      prev.reminders.length >= MAX_TASK_REMINDERS ||
      prev.reminders.includes(preset)
        ? prev
        : { ...prev, reminders: [...prev.reminders, preset] },
    );
  };
  const removeReminder = (preset: ReminderPreset) => {
    setForm((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((p) => p !== preset),
    }));
  };

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const found = validate(form);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    setErrors({});

    const workspaceId =
      form.workspace === "family"
        ? workspaces.family?.id
        : workspaces.privateWorkspaceId;

    if (!workspaceId) {
      setErrors({ form: "ไม่พบพื้นที่สำหรับสร้างงาน" });
      return;
    }

    startTransition(async () => {
      const result = await createTaskAction({
        workspaceId,
        title: form.title.trim(),
        notes: form.description.trim(),
        assigneeId: isFamily ? form.assigneeId || null : null,
        dueAtIso: bangkokDateTimeToUtcIso(form.dueDate, form.dueTime),
        reminderPresets: form.reminders,
      });

      if (!result.ok) {
        setErrors({ form: result.error ?? "สร้างงานไม่สำเร็จ" });
        return;
      }

      setFilter("all");
      toast.show("success", "สร้างงานใหม่แล้ว");
      router.push("/tasks");
    });
  }

  return (
    <form onSubmit={onSubmit} className="md:max-w-[960px]">
      <h1 className="mb-6 hidden text-[28px] font-semibold md:block">สร้างงานใหม่</h1>

      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
        <div className="fk-card flex flex-1 flex-col gap-5 p-5 md:p-7">
          <FormField id="task-title" label="ชื่องาน" required error={errors.title}>
            <input
              id="task-title"
              className={inputClass}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="เช่น ชำระค่าน้ำเดือนตุลาคม"
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "task-title-error" : undefined}
            />
          </FormField>

          <FormField id="task-description" label="รายละเอียดเพิ่มเติม">
            <textarea
              id="task-description"
              className={`${inputClass} min-h-20 resize-y leading-relaxed`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </FormField>

          <FormField label="การแจ้งเตือน">
            <ReminderPicker
              value={form.reminders}
              onAdd={addReminder}
              onRemove={removeReminder}
            />
          </FormField>
        </div>

        <div className="fk-card flex flex-col gap-5 p-5 md:w-[300px] md:p-6">
          <FormField label="พื้นที่" required error={errors.workspace}>
            <div className="flex gap-2">
              {availableWorkspaces.map((ws) => {
                const active = form.workspace === ws;
                return (
                  <button
                    key={ws}
                    type="button"
                    onClick={() => {
                      set("workspace", ws);
                      if (ws === "private") set("assigneeId", "");
                    }}
                    aria-pressed={active}
                    className={[
                      "min-h-11 rounded-pill px-4 text-[13px] font-semibold transition-colors",
                      active && ws === "private"
                        ? "bg-private-tint text-private-press ring-1 ring-private/25"
                        : active
                          ? "bg-family-tint text-family-press ring-1 ring-family/25"
                          : "border border-border bg-surface text-text-2 hover:text-text",
                    ].join(" ")}
                  >
                    {workspaceLabel(ws, familyName)}
                  </button>
                );
              })}
            </div>
          </FormField>

          {isFamily && workspaces.family ? (
            <FormField id="task-assignee" label="มอบหมายให้">
              <select
                id="task-assignee"
                className={inputClass}
                value={form.assigneeId}
                onChange={(e) => set("assigneeId", e.target.value)}
              >
                <option value="">ทุกคน</option>
                {workspaces.family.members.map((m) => (
                  <option key={m.profileId} value={m.profileId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}

          <FormField id="task-due-date" label="วันครบกำหนด" required error={errors.dueDate}>
            <input
              id="task-due-date"
              type="date"
              className={`${inputClass} min-h-11`}
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.dueDate)}
              aria-describedby={errors.dueDate ? "task-due-date-error" : undefined}
            />
          </FormField>

          <FormField id="task-due-time" label="เวลา" required error={errors.dueTime}>
            <input
              id="task-due-time"
              type="time"
              className={`${inputClass} min-h-11`}
              value={form.dueTime}
              onChange={(e) => set("dueTime", e.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.dueTime)}
              aria-describedby={errors.dueTime ? "task-due-time-error" : undefined}
            />
          </FormField>

          {errors.form ? (
            <p className="text-[12.5px] text-status-overdue-text">{errors.form}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className={[
                "fk-soft-hover min-h-11 rounded-standard px-5 text-sm font-semibold disabled:cursor-not-allowed",
                pending
                  ? "bg-border text-text-2"
                  : "fk-btn-primary",
              ].join(" ")}
            >
              {pending ? "กำลังบันทึก…" : "บันทึกงาน"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              disabled={pending}
              className="min-h-11 rounded-standard border border-border bg-surface-strong px-5 text-sm shadow-soft disabled:cursor-not-allowed"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
