import type { Timestamp } from "firebase/firestore";

interface Base {
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** item yang bisa disembunyikan dari daftar & kasir */
interface Hideable {
  hidden?: boolean;
}

export type WithId<T> = T & { id: string };

export interface Customer extends Base, Hideable {
  full_name: string;
  couple_name: string;
  no_hp: string;
  address: string;
  address_blok: string;
}

export interface PriceHistory {
  price: number;
  changed_at: Timestamp;
}

export interface Product extends Base, Hideable {
  name: string;
  /** kategori bebas (mis. Kopi, Non-kopi, Makanan); kosong = "Lainnya" */
  category?: string;
  price: number;
  history_price: PriceHistory[];
  hpp: number;
}

export interface Ingredient extends Base, Hideable {
  name: string;
  unit: string;
  /** stok sekarang */
  amount: number;
  /** harga per unit (rata-rata bergerak) */
  value: number;
  /** amount x value */
  total_value: number;
  /** batas minimal stok; stok <= batas -> peringatan segera beli (0/kosong = nonaktif) */
  min_amount?: number;
  /** harga per unit pembelian terakhir */
  last_price: number;
}

export interface IngredientBuy extends Base {
  ingredient_id: string;
  /** total uang yang dibayar */
  price: number;
  amount: number;
  unit_price: number;
  store: string;
}

export interface ProductIngredient extends Base {
  product_id: string;
  ingredient_id: string;
  /** jumlah bahan per 1 produk */
  amount: number;
}

export type PaymentMethod = "cash" | "qris";

export interface TransactionDetail {
  name: string;
  price: number;
  amount: number;
  hpp: number;
}

export interface Transaction extends Base {
  customer_id: string | null;
  payment_method: PaymentMethod;
  total: number;
  paid: number;
  change: number;
  /** modal = sum(ingredient_uses.value); cadangan (resep kosong) = sum(details.hpp x amount) */
  cost?: number;
  /** laba kotor transaksi: total - cost */
  profit?: number;
  /** key = product_id */
  details: Record<string, TransactionDetail>;
}

export type StockReason =
  | "terbuang"
  | "rusak"
  | "dipakai_sendiri"
  | "koreksi_kurang"
  | "koreksi_tambah"
  | "lainnya";

/**
 * Buku pemakaian bahan. Dari transaksi: transaction_id terisi.
 * Penyesuaian manual: transaction_id null + reason. amount/value bertanda:
 * positif = bahan keluar, negatif = koreksi tambah stok.
 */
export interface IngredientUse extends Base {
  ingredient_id: string;
  transaction_id: string | null;
  reason?: StockReason;
  note?: string;
  amount: number;
  value: number;
}

export type ExpenseCategory =
  | "gaji"
  | "sewa"
  | "listrik_air"
  | "gas"
  | "kemasan"
  | "bahan"
  | "lainnya";

/** Pengeluaran operasional (selain pembelian bahan) untuk hitung laba bersih. */
export interface Expense extends Base {
  name: string;
  /** "bahan" = pembelian bahan (disalin otomatis dari ingredient_buys) */
  category: ExpenseCategory;
  amount: number;
  /** keterangan singkat, mis. "100 pcs · Shopee" */
  note?: string;
  /** asal data; kosong dianggap manual */
  source?: "manual" | "ingredient_buy";
  /** id dokumen asal (ingredient_buys) kalau source = ingredient_buy */
  ref_id?: string;
  /** tanggal pengeluaran terjadi */
  date: Timestamp;
}

/**
 * Ringkasan PEMASUKAN harian berjalan. Id dokumen = tanggal lokal "yyyy-mm-dd".
 * Ditambah dengan increment() di dalam transaksi Firestore yang sama saat
 * createTransaction, jadi laporan per hari cukup membaca 1 dokumen per hari
 * (tanpa mengelompokkan ulang transactions). Field kosong dianggap 0.
 */
export interface DailyStat {
  /** jam 12 siang lokal pada hari itu (untuk filter rentang) */
  date: Timestamp;
  updated_at: Timestamp;
  income?: number; // sum(transactions.total)
  cash?: number; // bagian income yang dibayar cash
  qris?: number; // bagian income yang dibayar QRIS
  cost?: number; // modal
  profit?: number; // laba kotor
  trx_count?: number;
}
