export function PermissionDeniedState({
  title = "권한이 필요합니다",
  description = "이 작업을 수행할 권한이 없습니다. 필요한 Role 또는 Permission을 확인해 주세요."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-amber-900">{description}</p>
    </div>
  );
}
