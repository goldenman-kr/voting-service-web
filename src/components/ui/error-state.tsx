export function ErrorState({
  title = "요청을 처리할 수 없습니다",
  description = "잠시 후 다시 시도하거나 관리자에게 문의해 주세요."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-5 text-red-950">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-red-800">{description}</p>
    </div>
  );
}
