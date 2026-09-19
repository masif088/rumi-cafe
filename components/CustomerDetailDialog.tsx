"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { col } from "@/lib/db";
import { rupiah } from "@/lib/format";
import type { Customer, Transaction, WithId } from "@/lib/types";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

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

/** Detail pelanggan: total belanja, terakhir beli, favorit, dan transaksi terakhir. */
export default function CustomerDetailDialog({
  customer,
  onClose,
}: {
  customer: WithId<Customer> | undefined;
  onClose: () => void;
}) {
  const id = customer?.id;
  const [state, setState] = useState<{
    id: string;
    trx: WithId<Transaction>[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    // hanya filter customer_id (tanpa orderBy) supaya tidak butuh index; urut di sisi client
    return onSnapshot(
      query(col<Transaction>("transactions"), where("customer_id", "==", id)),
      (snap) =>
        setState({
          id,
          trx: snap.docs
            .map((d) => ({ ...d.data(), id: d.id }))
            .filter((t) => t.status !== "void")
            .sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis()),
        }),
      () => setState({ id, trx: [] }),
    );
  }, [id]);

  const trx = state && state.id === id ? state.trx : null;

  const totalSpent = customer?.total_spent ?? 0;
  const count = customer?.trx_count ?? 0;
  const favorites = Object.values(customer?.product_counts ?? {})
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return (
    <Dialog open={!!customer} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{customer?.full_name}</DialogTitle>
      <DialogContent className="flex flex-col gap-3 !pt-1">
        <Typography variant="body2" color="text.secondary">
          {[
            customer?.couple_name && `Pasangan: ${customer.couple_name}`,
            customer?.no_hp,
            customer?.address_blok && `Blok ${customer.address_blok}`,
            customer?.address,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Typography>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total pembelian" value={rupiah(totalSpent)} />
          <Stat label="Jumlah transaksi" value={String(count)} />
          <Stat
            label="Pembelian terakhir"
            value={
              customer?.last_purchase_at
                ? fmtDate(customer.last_purchase_at.toDate())
                : "-"
            }
          />
          <Stat
            label="Rata-rata / transaksi"
            value={count ? rupiah(Math.round(totalSpent / count)) : "-"}
          />
        </div>

        <div>
          <Typography variant="caption" color="text.secondary">
            Favorit
          </Typography>
          {favorites.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Belum ada data.
            </Typography>
          ) : (
            <div className="flex flex-wrap gap-1 pt-1">
              {favorites.map((f, i) => (
                <Chip
                  key={f.name}
                  size="small"
                  color={i === 0 ? "primary" : "default"}
                  variant={i === 0 ? "filled" : "outlined"}
                  label={`${f.name} × ${f.amount}`}
                />
              ))}
            </div>
          )}
        </div>

        <Divider />
        <Typography className="!text-sm !font-bold">Transaksi terakhir</Typography>
        {trx === null ? (
          <Typography variant="body2" color="text.secondary">
            Memuat...
          </Typography>
        ) : trx.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Belum ada transaksi.
          </Typography>
        ) : (
          <div className="flex flex-col gap-3">
            {trx.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Typography className="!text-sm !font-semibold">
                    {Object.values(t.details)
                      .map((d) => `${d.name} × ${d.amount}`)
                      .join(", ")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(t.created_at.toDate())} ·{" "}
                    {t.payment_method.toUpperCase()}
                  </Typography>
                </div>
                <Typography className="!text-sm !font-bold">
                  {rupiah(t.total)}
                </Typography>
              </div>
            ))}
            {trx.length > 10 && (
              <Typography variant="caption" color="text.secondary">
                Menampilkan 10 dari {trx.length} transaksi.
              </Typography>
            )}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Tutup</Button>
      </DialogActions>
    </Dialog>
  );
}
