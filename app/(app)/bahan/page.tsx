"use client";

import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Inventory2Icon from "@mui/icons-material/Inventory2Outlined";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasketOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import BuyHistoryDialog from "@/components/BuyHistoryDialog";
import EmptyState from "@/components/EmptyState";
import FormDialog from "@/components/FormDialog";
import ItemMenu from "@/components/ItemMenu";
import PageHeader from "@/components/PageHeader";
import {
  addItem,
  adjustIngredientStock,
  collections,
  deleteIngredient,
  recordIngredientBuy,
  updateItem,
} from "@/lib/db";
import { rupiah } from "@/lib/format";
import { useByDate, useCollection } from "@/lib/hooks";
import { isLow, reasonLabels } from "@/lib/stock";
import type { Ingredient, IngredientUse, StockReason } from "@/lib/types";

type Period = "today" | "week" | "month";

const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Hari ini" },
  { value: "week", label: "Minggu ini" },
  { value: "month", label: "Bulan ini" },
];

function startOf(period: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Senin
  if (period === "month") d.setDate(1);
  return d;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography className="!text-sm !font-semibold">{value}</Typography>
    </div>
  );
}

export default function BahanPage() {
  const { items, loading } = useCollection<Ingredient>(collections.ingredients);
  const [tab, setTab] = useState<"stok" | "terpakai">("stok");
  const [addOpen, setAddOpen] = useState(false);
  const [buyId, setBuyId] = useState<string | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [period, setPeriod] = useState<Period>("month");

  const start = useMemo(() => startOf(period), [period]);
  const { items: uses, loading: usesLoading } = useByDate<IngredientUse>(
    collections.ingredientUses,
    "created_at",
    start,
  );

  const buying = items.find((i) => i.id === buyId);
  const adjusting = items.find((i) => i.id === adjustId);
  const historyOf = items.find((i) => i.id === historyId);
  const editing = items.find((i) => i.id === editId);
  const visible = items.filter((i) => showHidden || !i.hidden);
  const hiddenCount = items.filter((i) => i.hidden).length;
  const lowItems = items.filter((i) => !i.hidden && isLow(i));

  // laporan bahan terpakai per bahan pada periode terpilih
  const report = useMemo(() => {
    const byIngredient = new Map<
      string,
      { amount: number; value: number; manual: number }
    >();
    for (const u of uses) {
      const cur = byIngredient.get(u.ingredient_id) ?? {
        amount: 0,
        value: 0,
        manual: 0,
      };
      cur.amount += u.amount;
      cur.value += u.value;
      if (u.transaction_id === null) cur.manual += u.amount;
      byIngredient.set(u.ingredient_id, cur);
    }
    return [...byIngredient.entries()]
      .map(([id, v]) => ({ id, ing: items.find((i) => i.id === id), ...v }))
      .sort((a, b) => b.value - a.value);
  }, [uses, items]);
  const reportTotal = report.reduce((s, r) => s + r.value, 0);
  const reportMax = report[0]?.value ?? 0;

  return (
    <>
      <PageHeader
        title="Bahan"
        subtitle={`${items.length} bahan · nilai stok ${rupiah(
          items.reduce((s, i) => s + i.total_value, 0),
        )}`}
        onAdd={() => setAddOpen(true)}
      />

      {lowItems.length > 0 && (
        <Alert severity="warning" className="mb-4">
          <strong>Segera beli:</strong>{" "}
          {lowItems
            .map((i) => `${i.name} (sisa ${i.amount} ${i.unit})`)
            .join(", ")}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        className="mb-4"
        variant="fullWidth"
      >
        <Tab value="stok" label="Stok" />
        <Tab value="terpakai" label="Bahan terpakai" />
      </Tabs>

      {tab === "stok" && (
        <>
          {hiddenCount > 0 && (
            <FormControlLabel
              className="mb-3"
              control={
                <Switch
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                />
              }
              label={`Tampilkan tersembunyi (${hiddenCount})`}
            />
          )}

          {!loading && visible.length === 0 && (
            <EmptyState
              icon={<Inventory2Icon />}
              title="Belum ada bahan"
              hint="Tambahkan bahan baku, lalu catat pembeliannya."
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((i) => (
              <Card
                key={i.id}
                className={
                  i.hidden
                    ? "opacity-60"
                    : isLow(i)
                      ? "!border-[var(--mui-palette-warning-main)]"
                      : ""
                }
              >
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Typography className="!font-bold">{i.name}</Typography>
                    <div className="flex items-center gap-1">
                      {i.hidden && (
                        <Chip size="small" variant="outlined" label="Tersembunyi" />
                      )}
                      <Chip
                        size="small"
                        color={
                          i.amount <= 0 ? "error" : isLow(i) ? "warning" : "default"
                        }
                        label={`${i.amount} ${i.unit}`}
                      />
                      <ItemMenu
                        name={i.name}
                        hidden={i.hidden}
                        deleteHint="Bahan akan dilepas dari semua resep."
                        onEdit={() => setEditId(i.id)}
                        onToggleHidden={() =>
                          updateItem(collections.ingredients, i.id, {
                            hidden: !i.hidden,
                          })
                        }
                        onDelete={() => deleteIngredient(i.id)}
                      />
                    </div>
                  </div>
                  {isLow(i) && (
                    <Typography
                      variant="caption"
                      className="!font-semibold !text-[var(--mui-palette-warning-main)]"
                    >
                      Stok menipis · batas {i.min_amount} {i.unit}, segera beli
                    </Typography>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label={`Harga / ${i.unit}`} value={rupiah(i.value)} />
                    <Stat label="Nilai stok" value={rupiah(i.total_value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ShoppingBasketIcon />}
                      onClick={() => setBuyId(i.id)}
                    >
                      Beli
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<TuneIcon />}
                      onClick={() => setAdjustId(i.id)}
                    >
                      Sesuaikan
                    </Button>
                  </div>
                  <Button
                    size="small"
                    color="inherit"
                    className="self-start !text-[var(--mui-palette-text-secondary)]"
                    onClick={() => setHistoryId(i.id)}
                  >
                    Lihat riwayat beli
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "terpakai" && (
        <>
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={period}
            onChange={(_, v: Period | null) => v && setPeriod(v)}
            className="mb-4"
          >
            {periods.map((p) => (
              <ToggleButton key={p.value} value={p.value}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Card className="mb-3">
            <CardContent className="flex justify-between !p-4">
              <Stat label="Jenis bahan terpakai" value={String(report.length)} />
              <Stat label="Total nilai terpakai" value={rupiah(reportTotal)} />
            </CardContent>
          </Card>

          {!usesLoading && report.length === 0 && (
            <EmptyState
              icon={<Inventory2Icon />}
              title="Belum ada bahan terpakai"
              hint="Bahan tercatat otomatis saat ada transaksi dari produk yang punya resep."
            />
          )}

          <div className="flex flex-col gap-3">
            {report.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 !p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <Typography className="!truncate !font-semibold">
                      {r.ing?.name ?? "Bahan dihapus"}
                    </Typography>
                    <Typography className="!text-sm !font-semibold">
                      {rupiah(r.value)}
                    </Typography>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--mui-palette-divider)]">
                    <div
                      className="h-full rounded-full bg-[var(--mui-palette-primary-main)]"
                      style={{
                        width: `${reportMax ? (r.value / reportMax) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <Typography variant="caption" color="text.secondary">
                    Terpakai {Math.round(r.amount * 100) / 100} {r.ing?.unit ?? ""}
                    {r.manual !== 0
                      ? ` (penyesuaian manual ${Math.round(r.manual * 100) / 100})`
                      : ""}
                    {r.ing ? ` · sisa ${r.ing.amount} ${r.ing.unit}` : ""}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <FormDialog
        open={addOpen}
        title="Tambah bahan"
        onClose={() => setAddOpen(false)}
        fields={[
          { name: "name", label: "Nama bahan" },
          { name: "unit", label: "Satuan (gr, ml, pcs)" },
          {
            name: "min_amount",
            label: "Batas minimal stok (peringatan beli)",
            type: "number",
            required: false,
          },
        ]}
        onSubmit={async (v) => {
          await addItem<Ingredient>(collections.ingredients, {
            name: v.name.trim(),
            unit: v.unit.trim(),
            amount: 0,
            value: 0,
            total_value: 0,
            last_price: 0,
            min_amount: Number(v.min_amount) || 0,
          });
        }}
      />
      <FormDialog
        open={!!editing}
        title={`Edit ${editing?.name ?? ""}`}
        initial={{
          name: editing?.name ?? "",
          unit: editing?.unit ?? "",
          min_amount: String(editing?.min_amount ?? ""),
        }}
        onClose={() => setEditId(null)}
        fields={[
          { name: "name", label: "Nama bahan" },
          { name: "unit", label: "Satuan (gr, ml, pcs)" },
          {
            name: "min_amount",
            label: "Batas minimal stok (peringatan beli)",
            type: "number",
            required: false,
          },
        ]}
        onSubmit={async (v) => {
          if (editId)
            await updateItem(collections.ingredients, editId, {
              name: v.name.trim(),
              unit: v.unit.trim(),
              min_amount: Number(v.min_amount) || 0,
            });
        }}
      />
      <BuyHistoryDialog
        ingredient={historyOf}
        onClose={() => setHistoryId(null)}
      />
      <FormDialog
        open={!!adjusting}
        title={`Sesuaikan stok ${adjusting?.name ?? ""}`}
        onClose={() => setAdjustId(null)}
        fields={[
          {
            name: "reason",
            label: "Alasan",
            type: "select",
            options: Object.entries(reasonLabels).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: "amount",
            label: `Jumlah (${adjusting?.unit ?? ""})`,
            type: "number",
          },
          { name: "note", label: "Catatan", required: false },
        ]}
        onSubmit={async (v) => {
          if (!adjustId) return;
          await adjustIngredientStock({
            ingredient_id: adjustId,
            reason: v.reason as StockReason,
            amount: Number(v.amount),
            note: v.note ?? "",
          });
        }}
      />
      <FormDialog
        open={!!buying}
        title={`Pembelian ${buying?.name ?? ""}`}
        onClose={() => setBuyId(null)}
        fields={[
          {
            name: "amount",
            label: `Jumlah (${buying?.unit ?? ""})`,
            type: "number",
          },
          { name: "price", label: "Total dibayar (Rp)", type: "number" },
          { name: "store", label: "Toko", required: false },
        ]}
        onSubmit={async (v) => {
          if (!buyId) return;
          const amount = Number(v.amount);
          if (amount <= 0) throw new Error("Jumlah harus lebih dari 0");
          await recordIngredientBuy({
            ingredient_id: buyId,
            amount,
            price: Number(v.price),
            store: v.store ?? "",
          });
        }}
      />
    </>
  );
}
