"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { ChatCircleDots, SignIn } from "@phosphor-icons/react";
import type { SafeAuthStatus } from "@/lib/auth/safe-auth-status";
import type { LineConnectionStatus } from "@/lib/line/line-connection";
import { createClient } from "@/lib/supabase/client";
import { LineGroupManager } from "./LineGroupManager";

interface LineSectionProps {
  authStatus: SafeAuthStatus;
  lineConnection: LineConnectionStatus;
}

const AUTH_ROWS = [
  {
    label: "สถานะ",
    getValue: (authStatus: SafeAuthStatus) =>
      authStatus.authenticated ? "authenticated" : "unauthenticated",
  },
  {
    label: "Supabase auth user ID",
    getValue: (authStatus: SafeAuthStatus) => authStatus.userId ?? "ไม่พบ",
  },
  {
    label: "Provider",
    getValue: (authStatus: SafeAuthStatus) => authStatus.providerName ?? "ไม่พบ",
  },
  {
    label: "LINE OIDC sub",
    getValue: (authStatus: SafeAuthStatus) =>
      authStatus.lineOidcSubFound ? "พบ" : "ไม่พบ",
  },
  {
    label: "Safe field path",
    getValue: (authStatus: SafeAuthStatus) => authStatus.lineOidcSubPath ?? "ไม่พบ",
  },
  {
    label: "Profile provisioned",
    getValue: (authStatus: SafeAuthStatus) =>
      authStatus.profileProvisioned ? "yes" : "no",
  },
  {
    label: "profiles.id matches auth user id",
    getValue: (authStatus: SafeAuthStatus) =>
      authStatus.profileIdMatchesAuthUser ? "yes" : "no",
  },
  {
    label: "profiles.line_user_id matches LINE sub",
    getValue: (authStatus: SafeAuthStatus) =>
      authStatus.profileLineUserIdMatchesLineSub ? "yes" : "no",
  },
] as const;

export function LineSection({ authStatus, lineConnection }: LineSectionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLineLogin() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "custom:line" as Provider,
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (signInError) {
        setError("เริ่มเข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
        setBusy(false);
      }
    } catch {
      setError("ยังไม่ได้ตั้งค่า Supabase สำหรับเครื่องนี้");
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="hidden text-2xl font-semibold md:block">การเชื่อมต่อ LINE</h1>

      <div className="flex flex-col gap-3 rounded-standard border border-border bg-surface-muted p-4">
        <div className="flex items-center gap-3">
          <ChatCircleDots size={24} className="shrink-0 text-text-2" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">การเชื่อมต่อ FamKeep กับ LINE</div>
            <div className="mt-0.5 text-[12.5px] text-text-2">
              เข้าสู่ระบบ:{" "}
              {authStatus.authenticated ? "เชื่อมแล้ว" : "ยังไม่ได้เข้าสู่ระบบ"}
              {" · "}บอท 1:1:{" "}
              {lineConnection.oneToOneLinked
                ? "เชื่อมแล้ว"
                : "ยังไม่ได้เชื่อม (ทักบอทด้วย #งาน เพื่อเริ่ม)"}
            </div>
          </div>
        </div>

        {lineConnection.workspaces.map((ws) => (
          <LineGroupManager key={ws.workspaceId} ws={ws} />
        ))}
      </div>

      <div className="flex flex-col gap-3 border-y border-border py-4">
        <button
          type="button"
          onClick={handleLineLogin}
          disabled={busy || !authStatus.supabaseConfigured}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-standard bg-text px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-border disabled:text-text-2"
        >
          <SignIn size={17} />
          {busy ? "กำลังเปิด LINE..." : "เข้าสู่ระบบด้วย LINE"}
        </button>

        {!authStatus.supabaseConfigured ? (
          <p className="text-[12.5px] leading-relaxed text-text-2">
            ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ในเครื่องนี้ก่อนเริ่มเข้าสู่ระบบ
          </p>
        ) : null}

        {error ? <p className="text-[12.5px] text-status-overdue-text">{error}</p> : null}
        {authStatus.error ? (
          <p className="text-[12.5px] text-status-overdue-text">{authStatus.error}</p>
        ) : null}
        {authStatus.profileProvisioningIssue ? (
          <p className="text-[12.5px] text-status-overdue-text">
            Profile provisioning: {authStatus.profileProvisioningIssue}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-standard bg-surface-muted p-4">
        <h2 className="text-sm font-semibold">Auth status</h2>
        <dl className="grid gap-2 text-[12.5px] md:grid-cols-[180px_1fr]">
          {AUTH_ROWS.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-text-2">{row.label}</dt>
              <dd className="min-w-0 break-words font-mono text-[12px] text-text">
                {row.getValue(authStatus)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] text-text-2">
        <p>เมื่อเชื่อมต่อแล้ว ใช้แฮชแท็กในกลุ่ม LINE เพื่อส่งข้อมูลเข้า FamKeep ได้ทันที</p>
        <p>
          <span className="font-semibold text-text">#งาน</span> — สร้างงานใหม่จากข้อความ
        </p>
        <p>
          <span className="font-semibold text-text">#เก็บ</span> — บันทึกไฟล์เข้าคลัง
        </p>
      </div>

      <button
        type="button"
        disabled
        title="พร้อมใช้งานเมื่อเชื่อมต่อ LINE Messaging API"
        className="min-h-11 w-fit rounded-standard bg-border px-4 text-sm font-semibold text-text-2 disabled:cursor-not-allowed"
      >
        ยกเลิกการเชื่อมต่อ
      </button>
    </section>
  );
}
