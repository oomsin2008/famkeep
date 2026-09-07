import Link from "next/link";

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/famkeep-logo.jpg"
        alt="FamKeep"
        width={64}
        height={64}
        className="size-16 rounded-[16px] shadow-soft ring-1 ring-black/5"
      />
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
