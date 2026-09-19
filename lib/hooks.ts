"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth } from "./firebase";
import { col } from "./db";
import type { Expense, Transaction, WithId } from "./types";

/** undefined = masih memuat, null = belum login */
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

export function useCollection<T>(name: string, orderField = "created_at") {
  const [items, setItems] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return onSnapshot(
      query(col<T>(name), orderBy(orderField, "desc")),
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [name, orderField]);
  return { items, loading };
}

/**
 * Dokumen dengan field tanggal >= start (null = semua), terbaru dulu.
 * `max` membatasi jumlah dokumen yang dibaca (hemat pembacaan).
 */
export function useByDate<T>(
  name: string,
  field: string,
  start: Date | null,
  max?: number,
) {
  const startMs = start?.getTime() ?? null;
  const key = `${startMs}-${max ?? ""}`;
  const [state, setState] = useState<{
    key: string;
    items: WithId<T>[];
  } | null>(null);
  useEffect(() => {
    const base = col<T>(name);
    const order = orderBy(field, "desc");
    const q =
      startMs === null
        ? max
          ? query(base, order, limit(max))
          : query(base, order)
        : max
          ? query(base, where(field, ">=", Timestamp.fromMillis(startMs)), order, limit(max))
          : query(base, where(field, ">=", Timestamp.fromMillis(startMs)), order);
    const done = (items: WithId<T>[]) => setState({ key, items });
    return onSnapshot(
      q,
      (snap) => done(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => done([]),
    );
  }, [name, field, startMs, max, key]);
  const ready = state !== null && state.key === key;
  return { items: ready ? state.items : [], loading: !ready };
}

export const useTransactions = (start: Date | null, max?: number) =>
  useByDate<Transaction>("transactions", "created_at", start, max);

export const useExpenses = (start: Date | null) =>
  useByDate<Expense>("expenses", "date", start);
