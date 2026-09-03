"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { ChatCircleDots, SignIn } from "@phosphor-icons/react";
import type { SafeAuthStatus } from "@/lib/auth/safe-auth-status";
import type { LineConnectionStatus } from "@/lib/line/line-connection";
import { createClient } from "@/lib/supabase/client";
import { ClayTile } from "@/components/ui/ClayTile";
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

      <div className="fk-card flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3.5">
          <ClayTile tone="green" size={48} radius={16}>
            <ChatCircleDots size={24} weight="fill" className="text-line" />
          </ClayTile>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">การเชื่อมต่อ FamKeep กับ LINE</div>
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

      <div className="fk-card flex flex-col gap-3 p-5">
        <button
          type="button"
          onClick={handleLineLogin}
          disabled={busy || !authStatus.supabaseConfigured}
          className="fk-soft-hover inline-flex min-h-11 w-fit items-center gap-2 rounded-standard bg-line px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(76,199,100,0.28)] disabled:cursor-not-allowed disabled:bg-border disabled:text-text-2 disabled:shadow-none"
        >
          <SignIn size={17} weight="bold" />
          {busy ? "กำลังเปิด LINE..." : "เข้าสู่ระบบด้วย LINE"}
        </button>

        {!authStatus.supabaseConfigured ? (
          <p className="text-[12.5px] leading-relaxed text-text-2">
            ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ในเครื่องนี้ก่อนเริ่มเข้าสู่ระบบ
          </p>
        ) : null}

        {error ? <p className="text-[12.5px] text-danger-strong">{error}</p> : null}
        {authStatus.error ? (
          <p className="text-[12.5px] text-danger-strong">{authStatus.error}</p>
        ) : null}
        {authStatus.profileProvisioningIssue ? (
          <p className="text-[12.5px] text-danger-strong">
            Profile provisioning: {authStatus.profileProvisioningIssue}
          </p>
        ) : null}
      </div>

      <div className="fk-clay fk-clay-green relative overflow-hidden rounded-card p-5 text-[13px] text-text-2">
        <span className="fk-blob -right-10 -top-10 size-32 bg-white opacity-40" />
        <p className="relative font-bold text-status-done-text">คำสั่งใน LINE</p>
        <p className="relative mt-1">
          <span className="font-semibold text-text">#งาน</span> — สร้างงานใหม่จากข้อความ
        </p>
        <p className="relative">
          <span className="font-semibold text-text">#เก็บ</span> — บันทึกไฟล์เข้าคลัง
        </p>
      </div>

      <details className="fk-card overflow-hidden p-0">
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-text-2">
          รายละเอียดการเชื่อมต่อ (สำหรับผู้ดูแล)
        </summary>
        <dl className="grid gap-2 border-t border-border/70 px-5 py-4 text-[12.5px] md:grid-cols-[180px_1fr]">
          {AUTH_ROWS.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-text-2">{row.label}</dt>
              <dd className="min-w-0 break-words font-mono text-[12px] text-text">
                {row.getValue(authStatus)}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      <button
        type="button"
        disabled
        title="พร้อมใช้งานเมื่อเชื่อมต่อ LINE Messaging API"
        className="min-h-11 w-fit rounded-standard border border-border bg-surface-muted px-4 text-sm font-semibold text-text-2 disabled:cursor-not-allowed"
      >
        ยกเลิกการเชื่อมต่อ
      </button>
    </section>
  );
}
