import type { Product } from "./types";

export const NO_CATEGORY = "Lainnya";

export const categoryOf = (p: Pick<Product, "category">) =>
  p.category?.trim() || NO_CATEGORY;

/** Daftar kategori unik (urut abjad, "Lainnya" di akhir). */
export function categoriesOf(products: Pick<Product, "category">[]) {
  const set = new Set(products.map(categoryOf));
  return [...set].sort((a, b) =>
    a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b, "id"),
  );
}
