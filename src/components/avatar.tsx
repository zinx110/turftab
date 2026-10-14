// Initials in a soft coloured circle; the colour is stable per name.
const tones = [
  "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  "bg-sky-600/15 text-sky-700 dark:text-sky-300",
  "bg-violet-600/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "bg-rose-600/15 text-rose-700 dark:text-rose-300",
  "bg-teal-600/15 text-teal-700 dark:text-teal-300",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const dims = size === "lg" ? "size-14 text-lg" : size === "sm" ? "size-7 text-[11px]" : "size-10 text-sm";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${tones[h % tones.length]}`}>
      {initials}
    </span>
  );
}
