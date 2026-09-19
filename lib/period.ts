export type Period = "today" | "week" | "month" | "all";

export const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Hari ini" },
  { value: "week", label: "Minggu ini" },
  { value: "month", label: "Bulan ini" },
  { value: "all", label: "Semua" },
];

/** Awal periode (null = tanpa batas). Minggu dimulai Senin. */
export function startOf(period: Period): Date | null {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "today") return d;
  if (period === "week") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  if (period === "month") {
    d.setDate(1);
    return d;
  }
  return null;
}

/** Kunci hari lokal, mis. "2026-09-19" (bisa diurutkan sebagai teks). */
export const dayKey = (d: Date) => d.toLocaleDateString("sv-SE");
