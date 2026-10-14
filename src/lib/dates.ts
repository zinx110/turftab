// Games are played in Bangladesh; "today" and display dates use this zone.
const TZ = "Asia/Dhaka";

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

// `iso` is a plain YYYY-MM-DD date; format it without any timezone shift.
export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Pieces for a calendar-style tile, without any timezone shift.
export function dateParts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const fmt = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  return { weekday: fmt({ weekday: "short" }), day: fmt({ day: "numeric" }), month: fmt({ month: "short" }), year: fmt({ year: "numeric" }) };
}
