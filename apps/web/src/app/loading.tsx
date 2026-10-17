export default function Loading() {
  return (
    <div className="container-page space-y-6 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat halaman</span>
      <div className="skeleton h-[380px] w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-white/[0.07] bg-ink-800">
            <div className="skeleton aspect-[2/3] w-full rounded-none" />
            <div className="space-y-2 p-2.5">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-2.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
