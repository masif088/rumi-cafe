"use client";

import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import WalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AddExpenseDialog from "@/components/AddExpenseDialog";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { collections, deleteItem, rebuildStats } from "@/lib/db";
import { categoryLabels } from "@/lib/expense";
import { rupiah } from "@/lib/format";
import { useByDate } from "@/lib/hooks";
import { dayKey } from "@/lib/period";
import type { DailyStat, Expense, WithId } from "@/lib/types";

type Range = "7" | "30" | "month";

const ranges: { value: Range; label: string }[] = [
  { value: "7", label: "7 hari" },
  { value: "30", label: "30 hari" },
  { value: "month", label: "Bulan ini" },
];

function startOfRange(range: Range): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "month") d.setDate(1);
  else d.setDate(d.getDate() - (Number(range) - 1));
  return d;
}

const n = (x?: number) => x ?? 0;
const signed = (v: number) => `${v < 0 ? "−" : "+"}${rupiah(Math.abs(v))}`;

interface Day {
  key: string;
  date: Date;
  stat?: DailyStat;
  expenses: WithId<Expense>[];
}

/**
 * Cash flow per hari.
 * Pemasukan: satu baris per hari dari daily_stats (sudah dikelompokkan).
 * Pengeluaran: tetap rinci per baris dari koleksi expenses.
 */
export default function CashFlowPage() {
  const [range, setRange] = useState<Range>("7");
  const [addOpen, setAddOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const start = useMemo(() => startOfRange(range), [range]);

  const { items: stats, loading: l1 } = useByDate<DailyStat>(
    collections.dailyStats,
    "date",
    start,
  );
  const { items: expenses, loading: l2 } = useByDate<Expense>(
    collections.expenses,
    "date",
    start,
  );

  const days: Day[] = useMemo(() => {
    const map = new Map<string, Day>();
    const get = (key: string, date: Date) => {
      let d = map.get(key);
      if (!d) {
        d = { key, date, expenses: [] };
        map.set(key, d);
      }
      return d;
    };
    for (const s of stats) {
      const date = s.date.toDate();
      get(dayKey(date), date).stat = s;
    }
    for (const e of expenses) {
      const date = e.date.toDate();
      get(dayKey(date), date).expenses.push(e);
    }
    // hari yang hanya berisi angka bahan / sudah nol (mis. transaksi dibatalkan) tidak ditampilkan
    return [...map.values()]
      .filter((d) => n(d.stat?.income) > 0 || d.expenses.length > 0)
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [stats, expenses]);

  const totalIn = stats.reduce((s, x) => s + n(x.income), 0);
  const totalOut = expenses.reduce((s, e) => s + e.amount, 0);
  const net = totalIn - totalOut;
  const loading = l1 || l2;

  const summary = [
    { label: "Uang masuk", value: rupiah(totalIn) },
    { label: "Uang keluar", value: rupiah(totalOut) },
    { label: "Selisih", value: signed(net), negative: net < 0 },
  ];

  return (
    <>
      <PageHeader
        title="Cash Flow"
        subtitle="Pemasukan penjualan dan pengeluaran per hari"
        onAdd={() => setAddOpen(true)}
        addLabel="Pengeluaran"
      />

      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={range}
        onChange={(_, v: Range | null) => v && setRange(v)}
        className="mb-4"
      >
        {ranges.map((r) => (
          <ToggleButton key={r.value} value={r.value}>
            {r.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="!p-3 sm:!p-4">
              <Typography variant="caption" color="text.secondary">
                {s.label}
              </Typography>
              <Typography
                className={`!text-sm !font-bold sm:!text-lg ${
                  s.negative ? "!text-[var(--mui-palette-error-main)]" : ""
                }`}
              >
                {s.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && days.length === 0 && (
        <EmptyState
          icon={<WalletIcon />}
          title="Belum ada data cash flow"
          hint="Pemasukan tercatat otomatis dari Kasir. Pembelian bahan dan pengeluaran umum muncul sebagai pengeluaran."
        />
      )}

      <div className="flex flex-col gap-3">
        {days.map((day) => {
          const inc = n(day.stat?.income);
          const out = day.expenses.reduce((s, e) => s + e.amount, 0);
          return (
            <Card key={day.key}>
              <CardContent className="flex flex-col gap-3 !p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <Typography className="!font-bold">
                    {day.date.toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </Typography>
                  <Typography
                    className={`!text-sm !font-bold ${
                      inc - out < 0 ? "!text-[var(--mui-palette-error-main)]" : ""
                    }`}
                  >
                    {signed(inc - out)}
                  </Typography>
                </div>

                <div className="flex flex-col gap-2">
                  {/* pemasukan: dikelompokkan jadi satu baris per hari */}
                  {inc > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Typography className="!text-sm !font-semibold">
                            Penjualan
                          </Typography>
                          <Chip size="small" color="primary" label="Masuk" />
                        </div>
                        <Typography variant="caption" color="text.secondary">
                          {n(day.stat?.trx_count)} transaksi · Cash{" "}
                          {rupiah(n(day.stat?.cash))} · QRIS{" "}
                          {rupiah(n(day.stat?.qris))}
                        </Typography>
                      </div>
                      <Typography className="!text-sm !font-bold">
                        {rupiah(inc)}
                      </Typography>
                    </div>
                  )}

                  {/* pengeluaran: tetap rinci per baris */}
                  {day.expenses.map((e) => (
                    <div key={e.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Typography className="!truncate !text-sm !font-semibold">
                            {e.name}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={e.category === "bahan" ? "secondary" : "default"}
                            label={
                              e.category === "bahan"
                                ? "Bahan"
                                : categoryLabels[e.category]
                            }
                          />
                        </div>
                        {e.note && (
                          <Typography variant="caption" color="text.secondary">
                            {e.note}
                          </Typography>
                        )}
                      </div>
                      <Typography className="!text-sm !font-bold">
                        −{rupiah(e.amount)}
                      </Typography>
                      {/* pembelian bahan tidak dihapus dari sini supaya stok tetap sinkron */}
                      {e.source !== "ingredient_buy" ? (
                        <IconButton
                          size="small"
                          aria-label={`Hapus ${e.name}`}
                          onClick={() => {
                            if (window.confirm(`Hapus pengeluaran "${e.name}"?`))
                              deleteItem(collections.expenses, e.id);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <span className="w-[30px]" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-start gap-1">
        <Button
          size="small"
          variant="outlined"
          disabled={rebuilding}
          onClick={async () => {
            if (
              !window.confirm(
                "Hitung ulang semua ringkasan harian dan statistik pelanggan dari data transaksi? Ini membaca semua transaksi sekali.",
              )
            )
              return;
            setRebuilding(true);
            try {
              const r = await rebuildStats();
              setMsg(
                `Selesai: ${r.transactions} transaksi, ${r.days} hari, ${r.customers} pelanggan`,
              );
            } catch {
              setMsg("Gagal menghitung ulang");
            } finally {
              setRebuilding(false);
            }
          }}
        >
          {rebuilding ? "Menghitung..." : "Hitung ulang ringkasan"}
        </Button>
        <Typography variant="caption" color="text.secondary">
          Membangun ulang ringkasan harian dan statistik pelanggan dari transaksi.
          Berguna untuk data lama atau kalau angkanya terlihat tidak cocok.
        </Typography>
      </div>

      <AddExpenseDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <Snackbar
        open={!!msg}
        autoHideDuration={4000}
        onClose={() => setMsg("")}
        message={msg}
      />
    </>
  );
}
