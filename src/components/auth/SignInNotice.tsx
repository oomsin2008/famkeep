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
    <div className="flex flex-col gap-3 py-10">
      <h1 className="text-[28px] font-semibold">{title}</h1>
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
            className="text-[13px] font-semibold text-private"
          >
            ไปที่การเชื่อมต่อ LINE
          </Link>
        </>
      )}
    </div>
  );
}
