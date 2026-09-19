import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { dayKey } from "./period";
import type {
  Customer,
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
type UsesPatch = Record<string, { amount: number; value: number; manual: number }>;

function dailyPatch(
  d: Date,
  inc: Partial<Record<Exclude<DailyField, "uses">, number>>,
  uses?: UsesPatch,
) {
  const noon = new Date(d);
  noon.setHours(12, 0, 0, 0);
  const patch: Record<string, unknown> = {
    date: Timestamp.fromDate(noon),
    updated_at: Timestamp.now(),
  };
  for (const [k, v] of Object.entries(inc)) patch[k] = increment(v as number);
  if (uses) {
    patch.uses = Object.fromEntries(
      Object.entries(uses).map(([id, u]) => [
        id,
        {
          amount: increment(u.amount),
          value: increment(u.value),
          manual: increment(u.manual),
        },
      ]),
    );
  }
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

    // pelanggan dibaca dulu (semua read sebelum write); bisa saja sudah dihapus
    const custRef = input.customer_id
      ? doc(db, collections.customers, input.customer_id)
      : null;
    const custSnap = custRef ? await tx.get(custRef) : null;

    const now = Timestamp.now();
    let usedCost = 0;
    const usesPatch: UsesPatch = {};
    for (const [id, used] of usage) {
      const ing = ingredients.get(id);
      if (!ing) continue;
      const value = used * ing.value;
      usedCost += value;
      usesPatch[id] = { amount: used, value, manual: 0 };
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
      dailyPatch(
        now.toDate(),
        {
        income: total,
        cash: input.payment_method === "cash" ? total : 0,
        qris: input.payment_method === "qris" ? total : 0,
        cost,
        profit: total - cost,
        trx_count: 1,
      },
      usesPatch,
      ),
      { merge: true },
    );

    // data berjalan pelanggan: total belanja, terakhir beli, favorit
    if (custRef && custSnap?.exists()) {
      tx.set(
        custRef,
        {
          total_spent: increment(total),
          trx_count: increment(1),
          last_purchase_at: now,
          updated_at: now,
          product_counts: Object.fromEntries(
            Object.entries(details).map(([pid, d]) => [
              pid,
              { name: d.name, amount: increment(d.amount) },
            ]),
          ),
        },
        { merge: true },
      );
    }
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
    tx.set(
      doc(db, collections.dailyStats, dayKey(now.toDate())),
      dailyPatch(now.toDate(), {}, {
        [input.ingredient_id]: { amount: used, value, manual: used },
      }),
      { merge: true },
    );
  });
}

/**
 * Batalkan transaksi: tandai void, kembalikan stok bahan, koreksi ringkasan harian
 * dan statistik pelanggan. Datanya tidak dihapus (jadi riwayat).
 */
export async function voidTransaction(trxId: string, reason = "") {
  // pemakaian bahan transaksi ini (query tidak bisa di dalam transaksi Firestore)
  const usesSnap = await getDocs(
    query(
      col<IngredientUse>(collections.ingredientUses),
      where("transaction_id", "==", trxId),
    ),
  );
  const trxRef = doc(db, collections.transactions, trxId);
  const ctx = { customerId: null as string | null };

  await runTransaction(db, async (tx) => {
    // ---- semua read dulu ----
    const snap = await tx.get(trxRef);
    if (!snap.exists()) throw new Error("Transaksi tidak ditemukan");
    const trx = snap.data() as Transaction;
    if (trx.status === "void") throw new Error("Transaksi sudah dibatalkan");
    ctx.customerId = trx.customer_id;

    const back = new Map<string, { amount: number; value: number }>();
    for (const u of usesSnap.docs) {
      const x = u.data();
      const cur = back.get(x.ingredient_id) ?? { amount: 0, value: 0 };
      cur.amount += x.amount;
      cur.value += x.value;
      back.set(x.ingredient_id, cur);
    }
    const ings = new Map<string, Ingredient>();
    for (const id of back.keys()) {
      const s = await tx.get(doc(db, collections.ingredients, id));
      if (s.exists()) ings.set(id, s.data() as Ingredient);
    }
    const custRef = trx.customer_id
      ? doc(db, collections.customers, trx.customer_id)
      : null;
    const custSnap = custRef ? await tx.get(custRef) : null;

    // ---- lalu write ----
    const now = Timestamp.now();
    const when = trx.created_at.toDate();
    const usesPatch: UsesPatch = {};
    for (const u of usesSnap.docs) tx.delete(u.ref);
    for (const [id, b] of back) {
      usesPatch[id] = { amount: -b.amount, value: -b.value, manual: 0 };
      const ing = ings.get(id);
      if (!ing) continue;
      const amount = ing.amount + b.amount;
      const total_value = ing.total_value + b.value;
      tx.update(doc(db, collections.ingredients, id), {
        amount,
        total_value,
        value: amount > 0 ? total_value / amount : ing.value,
        updated_at: now,
      });
    }

    tx.update(trxRef, {
      status: "void",
      voided_at: now,
      void_reason: reason,
      updated_at: now,
    });

    const cost =
      trx.cost ??
      Object.values(trx.details).reduce((sum, d) => sum + d.hpp * d.amount, 0);
    tx.set(
      doc(db, collections.dailyStats, dayKey(when)),
      dailyPatch(
        when,
        {
          income: -trx.total,
          cash: trx.payment_method === "cash" ? -trx.total : 0,
          qris: trx.payment_method === "qris" ? -trx.total : 0,
          cost: -cost,
          profit: -(trx.profit ?? trx.total - cost),
          trx_count: -1,
        },
        usesPatch,
      ),
      { merge: true },
    );

    if (custRef && custSnap?.exists()) {
      tx.set(
        custRef,
        {
          total_spent: increment(-trx.total),
          trx_count: increment(-1),
          updated_at: now,
          product_counts: Object.fromEntries(
            Object.entries(trx.details).map(([pid, d]) => [
              pid,
              { name: d.name, amount: increment(-d.amount) },
            ]),
          ),
        },
        { merge: true },
      );
    }
  });

  if (ctx.customerId) await refreshLastPurchase(ctx.customerId);
}

/** "Terakhir beli" pelanggan dihitung ulang dari transaksinya yang belum dibatalkan. */
async function refreshLastPurchase(customerId: string) {
  const cref = doc(db, collections.customers, customerId);
  const [cust, rest] = await Promise.all([
    getDoc(cref),
    getDocs(
      query(
        col<Transaction>(collections.transactions),
        where("customer_id", "==", customerId),
      ),
    ),
  ]);
  if (!cust.exists()) return;
  let last: Timestamp | null = null;
  for (const d of rest.docs) {
    const t = d.data();
    if (t.status === "void") continue;
    if (!last || t.created_at.toMillis() > last.toMillis()) last = t.created_at;
  }
  await updateDoc(cref, { last_purchase_at: last ?? deleteField() });
}

/**
 * Bangun ulang semua data turunan dari sumbernya:
 *  - daily_stats  <- transactions (bukan void) + ingredient_uses
 *  - statistik pelanggan (total, terakhir beli, favorit) <- transactions
 * Aman dijalankan kapan saja; hasilnya menimpa angka lama.
 */
export async function rebuildStats() {
  const [trxSnap, usesSnap, dailySnap, custSnap] = await Promise.all([
    getDocs(col<Transaction>(collections.transactions)),
    getDocs(col<IngredientUse>(collections.ingredientUses)),
    getDocs(col<DailyStat>(collections.dailyStats)),
    getDocs(col<Customer>(collections.customers)),
  ]);

  type Day = {
    date: Date;
    income: number;
    cash: number;
    qris: number;
    cost: number;
    profit: number;
    trx_count: number;
    uses: Record<string, { amount: number; value: number; manual: number }>;
  };
  const days = new Map<string, Day>();
  const dayOf = (d: Date) => {
    const key = dayKey(d);
    let day = days.get(key);
    if (!day) {
      const noon = new Date(d);
      noon.setHours(12, 0, 0, 0);
      day = { date: noon, income: 0, cash: 0, qris: 0, cost: 0, profit: 0, trx_count: 0, uses: {} };
      days.set(key, day);
    }
    return day;
  };

  type Cust = {
    total_spent: number;
    trx_count: number;
    last: Timestamp | null;
    product_counts: Record<string, { name: string; amount: number }>;
  };
  const custs = new Map<string, Cust>();

  let trxCount = 0;
  for (const d of trxSnap.docs) {
    const t = d.data();
    if (t.status === "void") continue;
    trxCount++;
    const cost =
      t.cost ??
      Object.values(t.details).reduce((sum, x) => sum + x.hpp * x.amount, 0);
    const day = dayOf(t.created_at.toDate());
    day.income += t.total;
    if (t.payment_method === "cash") day.cash += t.total;
    else day.qris += t.total;
    day.cost += cost;
    day.profit += t.profit ?? t.total - cost;
    day.trx_count += 1;

    if (t.customer_id) {
      const c = custs.get(t.customer_id) ?? {
        total_spent: 0,
        trx_count: 0,
        last: null,
        product_counts: {},
      };
      c.total_spent += t.total;
      c.trx_count += 1;
      if (!c.last || t.created_at.toMillis() > c.last.toMillis()) c.last = t.created_at;
      for (const [pid, x] of Object.entries(t.details)) {
        const pc = c.product_counts[pid] ?? { name: x.name, amount: 0 };
        pc.amount += x.amount;
        c.product_counts[pid] = pc;
      }
      custs.set(t.customer_id, c);
    }
  }

  for (const d of usesSnap.docs) {
    const u = d.data();
    const day = dayOf(u.created_at.toDate());
    const cur = day.uses[u.ingredient_id] ?? { amount: 0, value: 0, manual: 0 };
    cur.amount += u.amount;
    cur.value += u.value;
    if (u.transaction_id === null) cur.manual += u.amount;
    day.uses[u.ingredient_id] = cur;
  }

  const now = Timestamp.now();
  const ops: ((b: WriteBatch) => void)[] = [];
  for (const [key, day] of days) {
    ops.push((b) =>
      b.set(doc(db, collections.dailyStats, key), {
        date: Timestamp.fromDate(day.date),
        updated_at: now,
        income: day.income,
        cash: day.cash,
        qris: day.qris,
        cost: day.cost,
        profit: day.profit,
        trx_count: day.trx_count,
        uses: day.uses,
      }),
    );
  }
  // ringkasan hari yang ternyata sudah tidak punya data
  for (const d of dailySnap.docs) if (!days.has(d.id)) ops.push((b) => b.delete(d.ref));
  for (const d of custSnap.docs) {
    const c = custs.get(d.id);
    ops.push((b) =>
      b.update(d.ref, {
        total_spent: c?.total_spent ?? 0,
        trx_count: c?.trx_count ?? 0,
        last_purchase_at: c?.last ?? deleteField(),
        product_counts: c?.product_counts ?? {},
      }),
    );
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
  return { transactions: trxCount, days: days.size, customers: custSnap.size };
}

/**
 * Edit transaksi di tempat (waktu asli tetap). Dalam satu transaksi Firestore:
 * efek lama dibalik (stok, pemakaian bahan, ringkasan harian, statistik pelanggan),
 * lalu efek baru diterapkan. Baris produk yang sudah ada memakai harga/HPP
 * snapshot lama; produk yang baru ditambahkan memakai harga sekarang.
 */
export async function updateTransaction(
  trxId: string,
  input: {
    customer_id: string | null;
    payment_method: PaymentMethod;
    paid: number;
    /** price (opsional) = harga satuan baru; kosong = pakai harga snapshot/produk */
    items: { product_id: string; amount: number; price?: number }[];
  },
) {
  const items = input.items.filter((i) => i.amount > 0);
  if (items.length === 0) throw new Error("Minimal satu item");

  const trxRef = doc(db, collections.transactions, trxId);
  // ---- baca di luar transaksi Firestore (query tidak didukung di dalamnya) ----
  const oldSnap = await getDoc(trxRef);
  if (!oldSnap.exists()) throw new Error("Transaksi tidak ditemukan");
  const old0 = oldSnap.data() as Transaction;
  if (old0.status === "void") throw new Error("Transaksi sudah dibatalkan");

  const newProducts = new Map<string, Product>();
  const recipes = new Map<string, ProductIngredient[]>();
  for (const { product_id } of items) {
    if (!old0.details[product_id]) {
      const p = await getDoc(doc(db, collections.products, product_id));
      if (!p.exists()) throw new Error(`Produk ${product_id} tidak ditemukan`);
      newProducts.set(product_id, p.data() as Product);
    }
    const r = await getDocs(
      query(
        col<ProductIngredient>(collections.productIngredients),
        where("product_id", "==", product_id),
      ),
    );
    recipes.set(product_id, r.docs.map((d) => d.data()));
  }
  const usesSnap = await getDocs(
    query(
      col<IngredientUse>(collections.ingredientUses),
      where("transaction_id", "==", trxId),
    ),
  );

  const details: Record<string, TransactionDetail> = {};
  let total = 0;
  for (const { product_id, amount, price: override } of items) {
    const base =
      old0.details[product_id] ??
      (() => {
        const p = newProducts.get(product_id)!;
        return { name: p.name, price: p.price, hpp: p.hpp, amount: 0 };
      })();
    const price = override ?? base.price;
    details[product_id] = {
      name: base.name,
      price,
      hpp: base.hpp,
      amount: (details[product_id]?.amount ?? 0) + amount,
    };
    total += price * amount;
  }
  if (input.paid < total) throw new Error("Uang dibayar kurang dari total");
  const hppCost = Object.values(details).reduce((s, d) => s + d.hpp * d.amount, 0);

  const ctx = { oldCustomer: null as string | null };

  await runTransaction(db, async (tx) => {
    // ---- semua read dulu ----
    const snap = await tx.get(trxRef);
    if (!snap.exists()) throw new Error("Transaksi tidak ditemukan");
    const old = snap.data() as Transaction;
    if (old.status === "void") throw new Error("Transaksi sudah dibatalkan");
    ctx.oldCustomer = old.customer_id;

    const oldBack = new Map<string, { amount: number; value: number }>();
    for (const u of usesSnap.docs) {
      const x = u.data();
      const cur = oldBack.get(x.ingredient_id) ?? { amount: 0, value: 0 };
      cur.amount += x.amount;
      cur.value += x.value;
      oldBack.set(x.ingredient_id, cur);
    }
    const newUsage = new Map<string, number>();
    for (const [pid, d] of Object.entries(details)) {
      for (const r of recipes.get(pid) ?? []) {
        newUsage.set(r.ingredient_id, (newUsage.get(r.ingredient_id) ?? 0) + r.amount * d.amount);
      }
    }
    const ingIds = new Set([...oldBack.keys(), ...newUsage.keys()]);
    const ings = new Map<string, Ingredient>();
    for (const id of ingIds) {
      const s = await tx.get(doc(db, collections.ingredients, id));
      if (s.exists()) ings.set(id, s.data() as Ingredient);
    }
    const custIds = new Set([old.customer_id, input.customer_id].filter(Boolean) as string[]);
    const custExists = new Map<string, boolean>();
    for (const id of custIds) {
      custExists.set(id, (await tx.get(doc(db, collections.customers, id))).exists());
    }

    // ---- lalu write ----
    const now = Timestamp.now();
    const when = old.created_at.toDate();
    for (const u of usesSnap.docs) tx.delete(u.ref);

    let usedCost = 0;
    const usesDelta: UsesPatch = {};
    for (const id of ingIds) {
      const ing = ings.get(id);
      const back = oldBack.get(id) ?? { amount: 0, value: 0 };
      const used = ing ? (newUsage.get(id) ?? 0) : 0;
      const newValue = ing ? used * ing.value : 0;
      usedCost += newValue;
      usesDelta[id] = { amount: used - back.amount, value: newValue - back.value, manual: 0 };
      if (!ing) continue;
      const amount = ing.amount + back.amount - used;
      const total_value = ing.total_value + back.value - newValue;
      tx.update(doc(db, collections.ingredients, id), {
        amount,
        total_value,
        value: amount > 0 ? total_value / amount : ing.value,
        updated_at: now,
      });
      if (used > 0) {
        tx.set(doc(collection(db, collections.ingredientUses)), {
          ingredient_id: id,
          transaction_id: trxId,
          amount: used,
          value: newValue,
          created_at: old.created_at,
          updated_at: now,
        } satisfies IngredientUse);
      }
    }

    const cost = usedCost > 0 ? usedCost : hppCost;
    const oldCost =
      old.cost ?? Object.values(old.details).reduce((s, d) => s + d.hpp * d.amount, 0);
    const oldProfit = old.profit ?? old.total - oldCost;

    tx.update(trxRef, {
      customer_id: input.customer_id,
      payment_method: input.payment_method,
      total,
      paid: input.paid,
      change: input.paid - total,
      cost,
      profit: total - cost,
      details,
      edited_at: now,
      updated_at: now,
    });

    // ringkasan harian pada tanggal transaksi asli: selisih baru - lama
    tx.set(
      doc(db, collections.dailyStats, dayKey(when)),
      dailyPatch(
        when,
        {
          income: total - old.total,
          cash:
            (input.payment_method === "cash" ? total : 0) -
            (old.payment_method === "cash" ? old.total : 0),
          qris:
            (input.payment_method === "qris" ? total : 0) -
            (old.payment_method === "qris" ? old.total : 0),
          cost: cost - oldCost,
          profit: total - cost - oldProfit,
        },
        usesDelta,
      ),
      { merge: true },
    );

    // statistik pelanggan: lama dikurangi, baru ditambah (bisa pelanggan yang sama)
    const counts = (d: Record<string, TransactionDetail>) =>
      Object.entries(d).map(([pid, x]) => [pid, x.name, x.amount] as const);
    const custDelta = new Map<
      string,
      { spent: number; trx: number; products: Map<string, { name: string; amount: number }> }
    >();
    const bump = (
      cid: string,
      sign: 1 | -1,
      t: number,
      d: Record<string, TransactionDetail>,
    ) => {
      const c = custDelta.get(cid) ?? { spent: 0, trx: 0, products: new Map() };
      c.spent += sign * t;
      c.trx += sign;
      for (const [pid, name, amt] of counts(d)) {
        const p = c.products.get(pid) ?? { name, amount: 0 };
        p.amount += sign * amt;
        c.products.set(pid, p);
      }
      custDelta.set(cid, c);
    };
    if (old.customer_id) bump(old.customer_id, -1, old.total, old.details);
    if (input.customer_id) bump(input.customer_id, 1, total, details);
    for (const [cid, c] of custDelta) {
      if (!custExists.get(cid)) continue;
      tx.set(
        doc(db, collections.customers, cid),
        {
          total_spent: increment(c.spent),
          trx_count: increment(c.trx),
          updated_at: now,
          product_counts: Object.fromEntries(
            [...c.products].map(([pid, p]) => [
              pid,
              { name: p.name, amount: increment(p.amount) },
            ]),
          ),
        },
        { merge: true },
      );
    }
  });

  // "terakhir beli" bisa berubah kalau pelanggannya diganti
  const touched = new Set([ctx.oldCustomer, input.customer_id].filter(Boolean) as string[]);
  if (ctx.oldCustomer !== input.customer_id) {
    await Promise.all([...touched].map(refreshLastPurchase));
  }
}
