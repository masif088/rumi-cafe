"use client";

import { useMemo, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import TransaksiInsights from "@/components/TransaksiInsights";
import { collections } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { useCollection, useTransactions } from "@/lib/hooks";
import type { Customer } from "@/lib/types";

type Period = "today" | "week" | "month" | "all";

const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Hari ini" },
  { value: "week", label: "Minggu ini" },
  { value: "month", label: "Bulan ini" },
  { value: "all", label: "Semua" },
];

function startOf(period: Period): Date | null {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "today") return d;
  if (period === "week") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Senin
    return d;
  }
  if (period === "month") {
    d.setDate(1);
    return d;
  }
  return null;
}

export default function TransaksiPage() {
  const [period, setPeriod] = useState<Period>("today");
  // dihitung ulang hanya saat periode berganti
  const start = useMemo(() => startOf(period), [period]);
  const { items, loading } = useTransactions(start);
  // grafik selalu 30 hari terakhir, terlepas dari filter periode di atas
  const start30 = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 29);
    return d;
  }, []);
  const { items: last30 } = useTransactions(start30);
  const { items: customers } = useCollection<Customer>(collections.customers);
  const customerName = (id: string | null) =>
    id ? (customers.find((c) => c.id === id)?.full_name ?? "Pelanggan") : "Pembeli umum";

  const omzet = items.reduce((sum, t) => sum + t.total, 0);
  // transaksi lama belum punya field profit -> hitung dari hpp yang tersimpan
  const labaKotor = items.reduce(
    (sum, t) =>
      sum +
      (t.profit ??
        t.total -
          Object.values(t.details).reduce((x, d) => x + d.hpp * d.amount, 0)),
    0,
  );

  const stats = [
    { label: "Omzet", value: rupiah(omzet) },
    { label: "Laba kotor", value: rupiah(labaKotor) },
  ];

  return (
    <>
      <PageHeader title="Transaksi" subtitle={`${items.length} transaksi`} />

      <TransaksiInsights items={last30} customers={customers} />

      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={period}
        onChange={(_, v: Period | null) => v && setPeriod(v)}
        className="mb-4 flex-wrap"
      >
        {periods.map((p) => (
          <ToggleButton key={p.value} value={p.value}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <div className="mb-5 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="!p-3 sm:!p-4">
              <Typography variant="caption" color="text.secondary">
                {s.label}
              </Typography>
              <Typography className="!text-base !font-bold sm:!text-lg">
                {s.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && items.length === 0 && (
        <EmptyState
          icon={<ReceiptIcon />}
          title="Belum ada transaksi"
          hint="Transaksi dari halaman Kasir akan muncul di sini."
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Typography className="!font-bold">
                    {customerName(t.customer_id)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.created_at
                      .toDate()
                      .toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </Typography>
                </div>
                <Chip
                  size="small"
                  color={t.payment_method === "qris" ? "secondary" : "default"}
                  label={t.payment_method.toUpperCase()}
                />
              </div>

              <div className="flex flex-col gap-1">
                {Object.entries(t.details).map(([id, d]) => (
                  <div key={id} className="flex justify-between text-sm">
                    <span>
                      {d.name} × {d.amount}
                    </span>
                    <span className="text-[var(--mui-palette-text-secondary)]">
                      {rupiah(d.price * d.amount)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-baseline justify-between border-t border-[var(--mui-palette-divider)] pt-3">
                <Typography variant="body2" color="text.secondary">
                  {t.payment_method === "cash"
                    ? `Bayar ${rupiah(t.paid)} · Kembali ${rupiah(t.change)}`
                    : "Dibayar pas"}
                </Typography>
                <Typography className="!font-bold">{rupiah(t.total)}</Typography>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
