// Shared Tailwind class strings so pages stay consistent.
export const card = "rounded-2xl border border-line bg-surface p-4 shadow-sm";
export const input =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
export const btn =
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium transition hover:bg-subtle active:scale-[0.98] disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-red-600/30 bg-surface px-3.5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-600/5 active:scale-[0.98] disabled:opacity-60";
export const muted = "text-sm text-foreground/60";
export const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-foreground/55";

const pillBase = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
export const pill = {
  green: `${pillBase} bg-emerald-600/12 text-emerald-700 dark:text-emerald-400`,
  red: `${pillBase} bg-red-600/10 text-red-600 dark:text-red-400`,
  amber: `${pillBase} bg-amber-500/15 text-amber-700 dark:text-amber-400`,
  gray: `${pillBase} bg-subtle text-foreground/70`,
  blue: `${pillBase} bg-sky-600/12 text-sky-700 dark:text-sky-400`,
};
