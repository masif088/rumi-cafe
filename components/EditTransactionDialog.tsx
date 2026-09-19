"use client";

import { Fragment, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { updateTransaction } from "@/lib/db";
import { rupiah } from "@/lib/format";
import type { Customer, PaymentMethod, Product, Transaction, WithId } from "@/lib/types";

/**
 * Edit transaksi: item, jumlah, harga satuan, pelanggan, metode bayar, uang dibayar.
 * Satu-satunya yang tidak bisa diubah: waktu transaksi.
 * Dipasang dengan `key={trx.id}` supaya isiannya mulai dari data transaksi.
 */
export default function EditTransactionDialog({
  trx,
  customers,
  products,
  onClose,
}: {
  trx: WithId<Transaction>;
  customers: WithId<Customer>[];
  products: WithId<Product>[];
  onClose: () => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(trx.details).map(([id, d]) => [id, d.amount])),
  );
  // harga satuan per baris (teks supaya bisa dikosongkan saat mengetik)
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(trx.details).map(([id, d]) => [id, String(d.price)])),
  );
  const [customerId, setCustomerId] = useState(trx.customer_id ?? "");
  const [method, setMethod] = useState<PaymentMethod>(trx.payment_method);
  const [paid, setPaid] = useState(String(trx.paid));
  const [addId, setAddId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) =>
    trx.details[id]?.name ?? products.find((p) => p.id === id)?.name ?? "Produk";
  const priceOf = (id: string) => Number(prices[id]) || 0;

  const ids = Object.keys(qty).filter((id) => qty[id] > 0);
  const total = ids.reduce((s, id) => s + priceOf(id) * qty[id], 0);
  const paidNumber = method === "qris" ? total : Number(paid);
  const canSave = ids.length > 0 && paidNumber >= total && !busy;

  const addable = products.filter((p) => !p.hidden && !(qty[p.id] > 0));
  const customerList = customers.filter((c) => !c.hidden || c.id === trx.customer_id);

  function bump(id: string, delta: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));
  }

  function addProduct(id: string) {
    const p = products.find((x) => x.id === id);
    // produk baru mulai dari harga sekarang; produk lama tetap harga di transaksi
    if (p && prices[id] === undefined) {
      setPrices((pr) => ({ ...pr, [id]: String(p.price) }));
    }
    bump(id, 1);
  }

  async function save() {
    setError("");
    setBusy(true);
    try {
      await updateTransaction(trx.id, {
        customer_id: customerId || null,
        payment_method: method,
        paid: paidNumber,
        items: ids.map((id) => ({
          product_id: id,
          amount: qty[id],
          price: priceOf(id),
        })),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit transaksi</DialogTitle>
      <DialogContent className="flex flex-col gap-3 !pt-2">
        {error && <Alert severity="error">{error}</Alert>}

        {ids.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Belum ada item. Tambahkan produk di bawah.
          </Typography>
        ) : (
          // satu grid untuk semua baris supaya kolomnya lurus
          <div className="grid grid-cols-[minmax(0,1fr)_7rem_6.5rem] items-center gap-x-2 gap-y-3">
            <Typography variant="caption" color="text.secondary">
              Produk
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Harga satuan
            </Typography>
            <Typography variant="caption" color="text.secondary" className="text-center">
              Jumlah
            </Typography>

            {ids.map((id) => (
              <Fragment key={id}>
                <div className="min-w-0">
                  <Typography className="!truncate !text-sm !font-semibold">
                    {nameOf(id)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {rupiah(priceOf(id) * qty[id])}
                  </Typography>
                </div>
                <TextField
                  size="small"
                  type="number"
                  value={prices[id] ?? ""}
                  onChange={(e) => setPrices({ ...prices, [id]: e.target.value })}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      inputMode: "numeric",
                      "aria-label": `Harga satuan ${nameOf(id)}`,
                    },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">Rp</InputAdornment>
                      ),
                    },
                  }}
                />
                <div className="flex items-center justify-between">
                  <IconButton
                    size="small"
                    aria-label={`Kurangi ${nameOf(id)}`}
                    onClick={() => bump(id, -1)}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography className="!font-semibold">{qty[id]}</Typography>
                  <IconButton
                    size="small"
                    aria-label={`Tambah ${nameOf(id)}`}
                    onClick={() => bump(id, 1)}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </div>
              </Fragment>
            ))}
          </div>
        )}

        <TextField
          select
          size="small"
          label="Tambah produk"
          value={addId}
          onChange={(e) => {
            addProduct(e.target.value);
            setAddId("");
          }}
        >
          {addable.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name} · {rupiah(p.price)}
            </MenuItem>
          ))}
        </TextField>

        <Divider />
        <div className="flex items-baseline justify-between">
          <Typography color="text.secondary">Total</Typography>
          <Typography variant="h6">{rupiah(total)}</Typography>
        </div>

        <TextField
          select
          size="small"
          label="Pelanggan"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          slotProps={{
            select: { displayEmpty: true },
            inputLabel: { shrink: true },
          }}
        >
          <MenuItem value="">Pembeli umum</MenuItem>
          {customerList.map((c) => (
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
            type="number"
            label="Uang dibayar (Rp)"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            error={paid !== "" && paidNumber < total}
            helperText={
              paidNumber >= total
                ? `Kembalian ${rupiah(paidNumber - total)}`
                : "Uang dibayar kurang dari total"
            }
            slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
          />
        )}

        <Typography variant="caption" color="text.secondary">
          Semua bisa diubah kecuali waktu transaksi. Stok, laba, dan statistik
          pelanggan ikut dikoreksi otomatis.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="contained" disabled={!canSave} onClick={save}>
          Simpan perubahan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
