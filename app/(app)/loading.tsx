export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-64 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="h-20 animate-pulse rounded-[14px] border border-line bg-white" />
      <div className="h-64 animate-pulse rounded-[14px] border border-line bg-white" />
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}
