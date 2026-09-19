"use client";

import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import EditTransactionDialog from "@/components/EditTransactionDialog";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import TransaksiInsights from "@/components/TransaksiInsights";
import VoidTransactionDialog from "@/components/VoidTransactionDialog";
import { collections } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { useByDate, useCollection, useTransactions } from "@/lib/hooks";
import { periods, startOf, type Period } from "@/lib/period";
import type { Customer, DailyStat, Product } from "@/lib/types";

const PAGE_SIZE = 50;

export default function TransaksiPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [max, setMax] = useState(PAGE_SIZE);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  // dihitung ulang hanya saat periode berganti
  const start = useMemo(() => startOf(period), [period]);

  // daftar transaksi: dibatasi, "muat lebih banyak" menambah
  const { items, loading } = useTransactions(start, max);
  // angka ringkasan: dari daily_stats (satu dokumen per hari), bukan dari daftar di atas
  const { items: stats } = useByDate<DailyStat>("daily_stats", "date", start);
  // radar 30 hari terakhir
  const start30 = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 29);
    return d;
  }, []);
  const { items: days30 } = useByDate<DailyStat>("daily_stats", "date", start30);
  const { items: customers } = useCollection<Customer>(collections.customers);
  const { items: products } = useCollection<Product>(collections.products);

  const customerName = (id: string | null) =>
    id ? (customers.find((c) => c.id === id)?.full_name ?? "Pelanggan") : "Pembeli umum";
  const voiding = items.find((t) => t.id === voidId);
  const editing = items.find((t) => t.id === editId);

  const omzet = stats.reduce((s, d) => s + (d.income ?? 0), 0);
  const labaKotor = stats.reduce((s, d) => s + (d.profit ?? 0), 0);
  const count = stats.reduce((s, d) => s + (d.trx_count ?? 0), 0);

  const summary = [
    { label: "Omzet", value: rupiah(omzet) },
    { label: "Laba kotor", value: rupiah(labaKotor) },
  ];

  return (
    <>
      <PageHeader title="Transaksi" subtitle={`${count} transaksi`} />

      <TransaksiInsights days={days30} customers={customers} />

      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={period}
        onChange={(_, v: Period | null) => {
          if (v) {
            setPeriod(v);
            setMax(PAGE_SIZE);
          }
        }}
        className="mb-4 flex-wrap"
      >
        {periods.map((p) => (
          <ToggleButton key={p.value} value={p.value}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <div className="mb-5 grid grid-cols-2 gap-3">
        {summary.map((s) => (
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
        {items.map((t) => {
          const isVoid = t.status === "void";
          return (
            <Card key={t.id} className={isVoid ? "opacity-60" : ""}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Typography className="!font-bold">
                      {customerName(t.customer_id)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.created_at.toDate().toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-1">
                    {isVoid && <Chip size="small" color="error" label="Dibatalkan" />}
                    <Chip
                      size="small"
                      color={t.payment_method === "qris" ? "secondary" : "default"}
                      label={t.payment_method.toUpperCase()}
                    />
                  </div>
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
                    {isVoid
                      ? t.void_reason || "Dibatalkan"
                      : t.payment_method === "cash"
                        ? `Bayar ${rupiah(t.paid)} · Kembali ${rupiah(t.change)}`
                        : "Dibayar pas"}
                  </Typography>
                  <Typography
                    className={`!font-bold ${isVoid ? "line-through" : ""}`}
                  >
                    {rupiah(t.total)}
                  </Typography>
                </div>

                {!isVoid && (
                  <div className="flex items-center gap-1">
                    <Button size="small" variant="outlined" onClick={() => setEditId(t.id)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => setVoidId(t.id)}
                    >
                      Batalkan transaksi
                    </Button>
                    {t.edited_at && (
                      <Chip size="small" variant="outlined" label="Diedit" />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {items.length >= max && (
        <div className="mt-4 flex justify-center">
          <Button variant="outlined" onClick={() => setMax(max + PAGE_SIZE)}>
            Muat lebih banyak
          </Button>
        </div>
      )}

      <VoidTransactionDialog trx={voiding} onClose={() => setVoidId(null)} />
      {editing && (
        <EditTransactionDialog
          key={editing.id}
          trx={editing}
          customers={customers}
          products={products}
          onClose={() => setEditId(null)}
        />
      )}
    </>
  );
}
