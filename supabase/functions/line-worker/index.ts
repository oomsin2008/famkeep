// Reminder queue worker. verify_jwt = false; authenticated by a shared secret
// header (X-Worker-Secret) that pg_cron reads from Supabase Vault.
// Invoked ~every minute by the `famkeep-drain-jobs` cron job.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { pushMessage, textMessage } from "../_shared/line.ts";

const WORKER_SECRET = Deno.env.get("WORKER_SHARED_SECRET") ?? "";
const ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH = 10;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const PRESET_LABEL: Record<string, string> = {
  at_due_time: "ถึงกำหนดแล้ว",
  ten_minutes_before: "อีก 10 นาทีครบกำหนด",
  one_day_before: "พรุ่งนี้ครบกำหนด",
  morning_of_due: "วันนี้ครบกำหนด",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Job {
  id: string;
  payload: { reminder_id?: string } | null;
}
interface DispatchInfo {
  kind: "user" | "group" | "none";
  line_target: string | null;
  reason: string | null;
  task_title: string | null;
  due_at: string | null;
  preset: string | null;
}

Deno.serve(async (req) => {
  if (!WORKER_SECRET || req.headers.get("x-worker-secret") !== WORKER_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data: jobs, error } = await admin.rpc("claim_reminder_jobs", {
    p_limit: BATCH,
  });
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let failed = 0;

  for (const job of (jobs as Job[]) ?? []) {
    const reminderId = job.payload?.reminder_id;
    if (!reminderId) {
      await admin.rpc("fail_reminder_job", {
        p_job_id: job.id,
        p_error: "missing reminder_id",
        p_transient: false,
      });
      failed++;
      continue;
    }

    const { data: infoRows } = await admin.rpc("reminder_dispatch_info", {
      p_reminder_id: reminderId,
    });
    const info = (Array.isArray(infoRows) ? infoRows[0] : infoRows) as
      | DispatchInfo
      | undefined;

    if (!info || info.kind === "none") {
      await admin.rpc("fail_reminder_job", {
        p_job_id: job.id,
        p_error: info?.reason ?? "no dispatch info",
        p_transient: false,
      });
      failed++;
      continue;
    }

    const message = buildMessage(info);
    const res = await pushMessage(ACCESS_TOKEN, info.line_target!, [
      textMessage(message),
    ]);

    if (res.ok) {
      await admin.rpc("complete_reminder_job", {
        p_job_id: job.id,
        p_reminder_id: reminderId,
      });
      sent++;
    } else {
      const transient = res.status === 429 || res.status >= 500;
      await admin.rpc("fail_reminder_job", {
        p_job_id: job.id,
        p_error: `line ${res.status}: ${res.body.slice(0, 200)}`,
        p_transient: transient,
      });
      failed++;
    }
  }

  return json({ claimed: (jobs as Job[])?.length ?? 0, sent, failed });
});

function buildMessage(info: DispatchInfo): string {
  const when = info.due_at
    ? new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(info.due_at))
    : "";
  const lead = PRESET_LABEL[info.preset ?? ""] ?? "เตือนงาน";
  return `⏰ ${lead}\n${info.task_title ?? "งาน"}${when ? `\nกำหนด ${when}` : ""}`;
}
