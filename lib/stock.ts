import type { Ingredient, StockReason } from "./types";

/** Stok sudah di bawah/sama dengan batas minimal -> perlu segera beli. */
export const isLow = (i: Ingredient) =>
  (i.min_amount ?? 0) > 0 && i.amount <= (i.min_amount ?? 0);

export const reasonLabels: Record<StockReason, string> = {
  terbuang: "Terbuang",
  rusak: "Rusak / kadaluarsa",
  dipakai_sendiri: "Dipakai sendiri / sample",
  koreksi_kurang: "Koreksi stok (kurangi)",
  koreksi_tambah: "Koreksi stok (tambah)",
  lainnya: "Lainnya",
};
