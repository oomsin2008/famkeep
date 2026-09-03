import Link from "next/link";

const MESSAGE_BY_REASON: Record<string, string> = {
  exchange_failed: "ไม่สามารถแลกรหัสเข้าสู่ระบบกับ Supabase ได้",
  missing_code: "ไม่พบรหัสเข้าสู่ระบบจาก LINE",
  missing_supabase_config: "ยังไม่ได้ตั้งค่า Supabase สำหรับเครื่องนี้",
};

export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{
    reason?: string | string[];
    code_present?: string | string[];
    error?: string | string[];
    error_code?: string | string[];
    error_description?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const reason =
    typeof params.reason === "string" ? params.reason : "exchange_failed";
  const message = MESSAGE_BY_REASON[reason] ?? MESSAGE_BY_REASON.exchange_failed;
  const codePresent =
    params.code_present === "yes" || params.code_present === "no"
      ? params.code_present
      : null;
  const diagnostics = [
    { label: "code present", value: codePresent },
    {
      label: "error",
      value: typeof params.error === "string" ? params.error : null,
    },
    {
      label: "error_code",
      value: typeof params.error_code === "string" ? params.error_code : null,
    },
    {
      label: "error_description",
      value:
        typeof params.error_description === "string"
          ? params.error_description
          : null,
    },
  ].filter((item) => item.value !== null);

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">เข้าสู่ระบบไม่สำเร็จ</h1>
      <p className="text-sm leading-relaxed text-text-2">{message}</p>
      {diagnostics.length > 0 ? (
        <dl className="grid gap-2 rounded-standard bg-surface-muted p-4 text-[12.5px] md:grid-cols-[140px_1fr]">
          {diagnostics.map((item) => (
            <div key={item.label} className="contents">
              <dt className="text-text-2">{item.label}</dt>
              <dd className="min-w-0 break-words font-mono text-[12px] text-text">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Link
        href="/settings/line"
        className="inline-flex min-h-11 w-fit items-center rounded-standard border border-border px-4 text-sm font-semibold"
      >
        กลับไปที่การเชื่อมต่อ LINE
      </Link>
    </section>
  );
}
