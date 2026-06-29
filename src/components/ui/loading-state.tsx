export function LoadingState({ label = "불러오는 중입니다" }: { label?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">
      {label}
    </div>
  );
}
