import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
} from "firebase/firestore";
import { db } from "./firebase";
import { dayKey } from "./period";
import type {
  DailyStat,
  Expense,
  Ingredient,
  IngredientBuy,
  IngredientUse,
  StockReason,
  PaymentMethod,
  Product,
  ProductIngredient,
  Transaction,
  TransactionDetail,
} from "./types";

export const col = <T>(name: string) =>
  collection(db, name) as CollectionReference<T>;

export const collections = {
  customers: "customers",
  products: "products",
  ingredients: "ingredients",
  ingredientBuys: "ingredient_buys",
  productIngredients: "product_ingredients",
  transactions: "transactions",
  expenses: "expenses",
  dailyStats: "daily_stats",
  ingredientUses: "ingredient_uses",
} as const;

type DailyField = Exclude<keyof DailyStat, "date" | "updated_at">;

/** Isi set(..., {merge:true}) untuk menambah angka ke ringkasan pemasukan harian. */
function dailyPatch(d: Date, inc: Partial<Record<DailyField, number>>) {
  const noon = new Date(d);
  noon.setHours(12, 0, 0, 0);
  const patch: Record<string, unknown> = {
    date: Timestamp.fromDate(noon),
    updated_at: Timestamp.now(),
  };
  for (const [k, v] of Object.entries(inc)) patch[k] = increment(v as number);
  return patch;
}

/** Hitung ulang hpp produk dari resep x harga bahan sekarang. */
export async function recomputeProductHpp(productId: string) {
  const recipeSnap = await getDocs(
    query(
      col<ProductIngredient>(collections.productIngredients),
      where("product_id", "==", productId),
    ),
  );
  let hpp = 0;
  for (const r of recipeSnap.docs) {
    const { ingredient_id, amount } = r.data();
    const ing = await getDoc(doc(db, collections.ingredients, ingredient_id));
    if (ing.exists()) hpp += amount * (ing.data() as Ingredient).value;
  }
  const batch = writeBatch(db);
  batch.update(doc(db, collections.products, productId), {
    hpp,
    updated_at: Timestamp.now(),
  });
  await batch.commit();
  return hpp;
}

/** Ubah harga jual dan catat riwayat harga. */
export async function updateProductPrice(productId: string, price: number) {
  const ref = doc(db, collections.products, productId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Produk tidak ditemukan");
    const now = Timestamp.now();
    const product = snap.data() as Product;
    tx.update(ref, {
      price,
      history_price: [
        ...product.history_price,
        { price: product.price, changed_at: now },
      ],
      updated_at: now,
    });
  });
}

/** Catat pembelian bahan dan perbarui stok, nilai stok, serta harga rata-rata. */
export async function recordIngredientBuy(input: {
  ingredient_id: string;
  price: number; // total dibayar
  amount: number;
  store: string;
}) {
  const ingRef = doc(db, collections.ingredients, input.ingredient_id);
  const buyRef = doc(collection(db, collections.ingredientBuys));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ingRef);
    if (!snap.exists()) throw new Error("Bahan tidak ditemukan");
    const ing = snap.data() as Ingredient;
    const now = Timestamp.now();

    const unit_price = input.price / input.amount;
    const amount = ing.amount + input.amount;
    const total_value = ing.total_value + input.price;

    tx.update(ingRef, {
      amount,
      total_value,
      value: amount > 0 ? total_value / amount : unit_price,
      last_price: unit_price,
      updated_at: now,
    });
    tx.set(buyRef, {
      ...input,
      unit_price,
      created_at: now,
      updated_at: now,
    } satisfies IngredientBuy);
    // salinan ke expenses (id tetap = buy_<id>) supaya laporan pengeluaran
    // cukup membaca satu koleksi
    tx.set(doc(db, collections.expenses, `buy_${buyRef.id}`), {
      name: `Beli ${ing.name}`,
      category: "bahan",
      amount: input.price,
      note: `${input.amount} ${ing.unit}${input.store ? ` · ${input.store}` : ""}`,
      source: "ingredient_buy",
      ref_id: buyRef.id,
      date: now,
      created_at: now,
      updated_at: now,
    } satisfies Expense);
  });

  // harga bahan berubah -> hpp produk yang memakainya ikut berubah
  const used = await getDocs(
    query(
      col<ProductIngredient>(collections.productIngredients),
      where("ingredient_id", "==", input.ingredient_id),
    ),
  );
  const productIds = new Set(used.docs.map((d) => d.data().product_id));
  await Promise.all([...productIds].map(recomputeProductHpp));
}

/**
 * Buat transaksi: simpan transaksi, catat pemakaian bahan, dan kurangi stok.
 * Harga & hpp produk di-snapshot ke details.
 */
export async function createTransaction(input: {
  customer_id: string | null;
  payment_method: PaymentMethod;
  paid: number;
  items: { product_id: string; amount: number }[];
}) {
  // baca produk & resep dulu (query tidak didukung di dalam transaction client)
  const products = new Map<string, Product>();
  const recipes = new Map<string, ProductIngredient[]>();
  for (const { product_id } of input.items) {
    const p = await getDoc(doc(db, collections.products, product_id));
    if (!p.exists()) throw new Error(`Produk ${product_id} tidak ditemukan`);
    products.set(product_id, p.data() as Product);
    const r = await getDocs(
      query(
        col<ProductIngredient>(collections.productIngredients),
        where("product_id", "==", product_id),
      ),
    );
    recipes.set(
      product_id,
      r.docs.map((d) => d.data()),
    );
  }

  const details: Record<string, TransactionDetail> = {};
  let total = 0;
  for (const { product_id, amount } of input.items) {
    const p = products.get(product_id)!;
    const prev = details[product_id];
    details[product_id] = {
      name: p.name,
      price: p.price,
      hpp: p.hpp,
      amount: (prev?.amount ?? 0) + amount,
    };
    total += p.price * amount;
  }
  if (input.paid < total) throw new Error("Uang dibayar kurang dari total");

  const hppCost = Object.values(details).reduce(
    (sum, d) => sum + d.hpp * d.amount,
    0,
  );
  const trxRef = doc(collection(db, collections.transactions));

  await runTransaction(db, async (tx) => {
    // total bahan yang dipakai, digabung per bahan
    const usage = new Map<string, number>();
    for (const [productId, d] of Object.entries(details)) {
      for (const r of recipes.get(productId) ?? []) {
        usage.set(
          r.ingredient_id,
          (usage.get(r.ingredient_id) ?? 0) + r.amount * d.amount,
        );
      }
    }

    // semua read dulu sebelum write
    const ingredients = new Map<string, Ingredient>();
    for (const id of usage.keys()) {
      const snap = await tx.get(doc(db, collections.ingredients, id));
      if (snap.exists()) ingredients.set(id, snap.data() as Ingredient);
    }

    const now = Timestamp.now();
    let usedCost = 0;
    for (const [id, used] of usage) {
      const ing = ingredients.get(id);
      if (!ing) continue;
      const value = used * ing.value;
      usedCost += value;
      tx.update(doc(db, collections.ingredients, id), {
        amount: ing.amount - used,
        total_value: ing.total_value - value,
        updated_at: now,
      });
      tx.set(doc(collection(db, collections.ingredientUses)), {
        ingredient_id: id,
        transaction_id: trxRef.id,
        amount: used,
        value,
        created_at: now,
        updated_at: now,
      } satisfies IngredientUse);
    }

    // modal dari pemakaian bahan sebenarnya; kalau tidak ada resep, pakai hpp
    const cost = usedCost > 0 ? usedCost : hppCost;
    tx.set(trxRef, {
      customer_id: input.customer_id,
      payment_method: input.payment_method,
      total,
      paid: input.paid,
      change: input.paid - total,
      cost,
      profit: total - cost,
      details,
      created_at: now,
      updated_at: now,
    } satisfies Transaction);
    tx.set(
      doc(db, collections.dailyStats, dayKey(now.toDate())),
      dailyPatch(now.toDate(), {
        income: total,
        cash: input.payment_method === "cash" ? total : 0,
        qris: input.payment_method === "qris" ? total : 0,
        cost,
        profit: total - cost,
        trx_count: 1,
      }),
      { merge: true },
    );
  });

  return trxRef.id;
}

/** Helper tambah dokumen biasa (customers, products, ingredients, resep). */
export async function addItem<T extends { created_at?: unknown }>(
  name: string,
  data: Omit<T, "created_at" | "updated_at">,
) {
  const now = Timestamp.now();
  return addDoc(col(name), { ...data, created_at: now, updated_at: now });
}

/** Ubah field dokumen biasa. */
export async function updateItem(
  name: string,
  id: string,
  data: Record<string, unknown>,
) {
  await updateDoc(doc(db, name, id), { ...data, updated_at: Timestamp.now() });
}

export async function deleteItem(name: string, id: string) {
  await deleteDoc(doc(db, name, id));
}

/** Hapus produk beserta resepnya. Riwayat transaksi tetap aman (snapshot). */
export async function deleteProduct(productId: string) {
  const recipes = await getDocs(
    query(
      col<ProductIngredient>(collections.productIngredients),
      where("product_id", "==", productId),
    ),
  );
  const batch = writeBatch(db);
  recipes.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, collections.products, productId));
  await batch.commit();
}

/** Hapus bahan, lepas dari semua resep, lalu hitung ulang HPP produk terkait. */
export async function deleteIngredient(ingredientId: string) {
  const recipes = await getDocs(
    query(
      col<ProductIngredient>(collections.productIngredients),
      where("ingredient_id", "==", ingredientId),
    ),
  );
  const productIds = new Set(recipes.docs.map((d) => d.data().product_id));
  const batch = writeBatch(db);
  recipes.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, collections.ingredients, ingredientId));
  await batch.commit();
  await Promise.all([...productIds].map(recomputeProductHpp));
}

/** Tambah bahan ke resep (kalau sudah ada, jumlahnya diganti), lalu hitung ulang HPP. */
export async function setRecipeItem(
  productId: string,
  ingredientId: string,
  amount: number,
) {
  const existing = await getDocs(
    query(
      col<ProductIngredient>(collections.productIngredients),
      where("product_id", "==", productId),
      where("ingredient_id", "==", ingredientId),
    ),
  );
  if (existing.empty) {
    await addItem<ProductIngredient>(collections.productIngredients, {
      product_id: productId,
      ingredient_id: ingredientId,
      amount,
    });
  } else {
    await updateItem(collections.productIngredients, existing.docs[0].id, {
      amount,
    });
  }
  await recomputeProductHpp(productId);
}

/** Buang satu bahan dari resep, lalu hitung ulang HPP. */
export async function removeRecipeItem(recipeId: string, productId: string) {
  await deleteItem(collections.productIngredients, recipeId);
  await recomputeProductHpp(productId);
}

/**
 * Penyesuaian stok manual (bahan terbuang, rusak, koreksi, dll).
 * Dicatat di ingredient_uses tanpa transaction_id supaya ikut laporan bahan terpakai.
 */
export async function adjustIngredientStock(input: {
  ingredient_id: string;
  reason: StockReason;
  amount: number; // selalu positif; arah ditentukan alasan
  note: string;
}) {
  if (!(input.amount > 0)) throw new Error("Jumlah harus lebih dari 0");
  const ingRef = doc(db, collections.ingredients, input.ingredient_id);
  const useRef = doc(collection(db, collections.ingredientUses));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ingRef);
    if (!snap.exists()) throw new Error("Bahan tidak ditemukan");
    const ing = snap.data() as Ingredient;
    const now = Timestamp.now();

    // positif = bahan keluar, negatif = stok bertambah
    const used = input.reason === "koreksi_tambah" ? -input.amount : input.amount;
    if (ing.amount - used < 0) {
      throw new Error(`Melebihi stok (sisa ${ing.amount} ${ing.unit})`);
    }
    const value = used * ing.value;

    tx.update(ingRef, {
      amount: ing.amount - used,
      total_value: ing.total_value - value,
      updated_at: now,
    });
    tx.set(useRef, {
      ingredient_id: input.ingredient_id,
      transaction_id: null,
      reason: input.reason,
      note: input.note,
      amount: used,
      value,
      created_at: now,
      updated_at: now,
    } satisfies IngredientUse);
  });
}
