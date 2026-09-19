"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
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

/** Dokumen dengan field tanggal >= start (null = semua), terbaru dulu. */
export function useByDate<T>(name: string, field: string, start: Date | null) {
  const startMs = start?.getTime() ?? null;
  const [state, setState] = useState<{
    key: number | null;
    items: WithId<T>[];
  } | null>(null);
  useEffect(() => {
    const base = col<T>(name);
    const q =
      startMs === null
        ? query(base, orderBy(field, "desc"))
        : query(
            base,
            where(field, ">=", Timestamp.fromMillis(startMs)),
            orderBy(field, "desc"),
          );
    const done = (items: WithId<T>[]) => setState({ key: startMs, items });
    return onSnapshot(
      q,
      (snap) => done(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => done([]),
    );
  }, [name, field, startMs]);
  const ready = state !== null && state.key === startMs;
  return { items: ready ? state.items : [], loading: !ready };
}

export const useTransactions = (start: Date | null) =>
  useByDate<Transaction>("transactions", "created_at", start);

export const useExpenses = (start: Date | null) =>
  useByDate<Expense>("expenses", "date", start);
