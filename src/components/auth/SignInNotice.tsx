import Link from "next/link";
import { SignIn } from "@phosphor-icons/react/dist/ssr";

/** Shown on authenticated screens when the visitor is not a signed-in FamKeep user. */
export function SignInNotice({
  reason,
  title = "FamKeep",
}: {
  reason: "unconfigured" | "signed_out";
  title?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-14 text-center">
      <span className="fk-clay flex size-16 items-center justify-center rounded-card text-brand-coral">
        <SignIn size={28} weight="duotone" />
      </span>
      <h1 className="text-[24px] font-semibold">{title}</h1>
      {reason === "unconfigured" ? (
        <p className="text-sm text-text-2">
          ยังไม่ได้ตั้งค่า Supabase สำหรับเครื่องนี้
        </p>
      ) : (
        <>
          <p className="text-sm text-text-2">
            เข้าสู่ระบบด้วย LINE ก่อนเพื่อดูและจัดการข้อมูลของคุณ
          </p>
          <Link
            href="/settings/line"
            className="fk-btn-primary fk-soft-hover inline-flex min-h-11 items-center rounded-standard px-5 text-sm font-semibold"
          >
            ไปที่การเชื่อมต่อ LINE
          </Link>
        </>
      )}
    </div>
  );
}
