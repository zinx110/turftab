export const metadata = { title: "Offline · TurfTab" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="opacity-70">
        TurfTab needs a connection to load and save games and payments. Check your signal and try again.
      </p>
      {/* Plain <a> on purpose: a full page load is the right retry when the network returns. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white">
        Try again
      </a>
    </main>
  );
}
