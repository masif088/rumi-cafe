"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import LocalCafeIcon from "@mui/icons-material/LocalCafeOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCartOutlined";
import CategoryFilter from "@/components/CategoryFilter";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { collections, createTransaction } from "@/lib/db";
import { categoriesOf, categoryOf } from "@/lib/category";
import { rupiah } from "@/lib/format";
import { useCollection } from "@/lib/hooks";
import type { Customer, PaymentMethod, Product } from "@/lib/types";

export default function KasirPage() {
  const { items: products, loading } = useCollection<Product>(
    collections.products,
  );
  const { items: customers } = useCollection<Customer>(collections.customers);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paid, setPaid] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState("all");

  const sellable = products.filter((p) => !p.hidden);
  const categories = categoriesOf(sellable);
  const shown = sellable.filter((p) => cat === "all" || categoryOf(p) === cat);
  // keranjang tetap dihitung dari semua produk, walau filter kategori berganti
  const lines = sellable.filter((p) => cart[p.id] > 0);
  const total = lines.reduce((sum, p) => sum + p.price * cart[p.id], 0);
  const paidNumber = method === "qris" ? total : Number(paid);
  const change = paidNumber - total;

  function add(id: string, delta: number) {
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));
  }

  async function handleCheckout() {
    setError("");
    setBusy(true);
    try {
      await createTransaction({
        customer_id: customerId || null,
        payment_method: method,
        paid: paidNumber,
        items: lines.map((p) => ({ product_id: p.id, amount: cart[p.id] })),
      });
      setCart({});
      setPaid("");
      setCustomerId("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaksi gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Kasir" subtitle="Ketuk menu untuk menambah pesanan" />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <section>
          {!loading && sellable.length === 0 && (
            <EmptyState
              icon={<LocalCafeIcon />}
              title="Belum ada produk"
              hint="Tambahkan menu dulu di halaman Produk."
            />
          )}
          <CategoryFilter categories={categories} value={cat} onChange={setCat} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <Card
                  key={p.id}
                  className={
                    qty > 0
                      ? "!border-[var(--mui-palette-primary-main)] !border-2"
                      : ""
                  }
                >
                  <CardActionArea
                    onClick={() => add(p.id, 1)}
                    className="flex min-h-28 flex-col items-start justify-between gap-3 p-4"
                  >
                    <div className="flex w-full items-start justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-[var(--mui-palette-divider)] text-[var(--mui-palette-primary-main)]">
                        <LocalCafeIcon fontSize="small" />
                      </span>
                      {qty > 0 && (
                        <Badge badgeContent={qty} color="primary" className="mr-2" />
                      )}
                    </div>
                    <div>
                      <Typography className="!font-semibold !leading-tight">
                        {p.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {rupiah(p.price)}
                      </Typography>
                    </div>
                  </CardActionArea>
                </Card>
              );
            })}
          </div>
        </section>

        <Paper
          variant="outlined"
          className="flex flex-col gap-4 rounded-3xl p-5 lg:sticky lg:top-20"
        >
          <div className="flex items-center gap-2">
            <ShoppingCartIcon color="primary" />
            <Typography className="!font-bold">Pesanan</Typography>
          </div>

          {lines.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Belum ada item.
            </Typography>
          ) : (
            <div className="flex flex-col gap-3">
              {lines.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Typography className="!truncate !text-sm !font-semibold">
                      {p.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rupiah(p.price * cart[p.id])}
                    </Typography>
                  </div>
                  <IconButton size="small" onClick={() => add(p.id, -1)}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography className="w-5 text-center !font-semibold">
                    {cart[p.id]}
                  </Typography>
                  <IconButton size="small" onClick={() => add(p.id, 1)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </div>
              ))}
            </div>
          )}

          <Divider />
          <div className="flex items-baseline justify-between">
            <Typography color="text.secondary">Total</Typography>
            <Typography variant="h5">{rupiah(total)}</Typography>
          </div>

          <TextField
            select
            size="small"
            label="Pelanggan (opsional)"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <MenuItem value="">Pembeli umum</MenuItem>
            {customers
              .filter((c) => !c.hidden)
              .map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.full_name}
              </MenuItem>
            ))}
          </TextField>

          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={method}
            onChange={(_, v: PaymentMethod | null) => v && setMethod(v)}
          >
            <ToggleButton value="cash">Cash</ToggleButton>
            <ToggleButton value="qris">QRIS</ToggleButton>
          </ToggleButtonGroup>

          {method === "cash" && (
            <TextField
              size="small"
              label="Uang dibayar (Rp)"
              type="number"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              helperText={
                paid !== "" && change >= 0
                  ? `Kembalian ${rupiah(change)}`
                  : undefined
              }
              slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
            />
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            size="large"
            disabled={busy || total === 0 || paidNumber < total}
            onClick={handleCheckout}
          >
            {busy ? "Memproses..." : "Bayar"}
          </Button>
        </Paper>
      </div>

      <Snackbar
        open={done}
        autoHideDuration={3000}
        onClose={() => setDone(false)}
        message="Transaksi berhasil"
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      />
    </>
  );
}
