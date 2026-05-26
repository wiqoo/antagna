'use client';

/**
 * Offline fallback. The service worker precaches this route and serves it when a
 * navigation fails with no network. No data, no auth — purely static shell so it
 * works from cache. Added to the middleware public allowlist so the install-time
 * precache fetch isn't bounced to /login.
 */
export default function OfflinePage() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0F0F12] p-6 text-center text-white"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#FF6B1A] to-[#FF8A3D] text-2xl font-bold text-black">
        A
      </div>
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">لا يوجد اتصال بالإنترنت</h1>
        <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-white/50">
          تعذّر الوصول إلى Antagna. تحقّق من اتصالك وحاول مجدداً — الصفحات التي زرتها
          مؤخراً قد تبقى متاحة دون اتصال.
        </p>
      </div>
      <button
        onClick={() => location.reload()}
        className="rounded-lg bg-[#FF6B1A] px-4 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
      >
        إعادة المحاولة
      </button>
      <p className="text-[12px] text-white/30">You&apos;re offline · Antagna</p>
    </main>
  );
}
