"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { col } from "@/lib/db";
import { rupiah } from "@/lib/format";
import type { Ingredient, IngredientBuy, WithId } from "@/lib/types";

/** Riwayat pembelian satu bahan: kapan, berapa, di mana, dan harga per unit. */
export default function BuyHistoryDialog({
  ingredient,
  onClose,
}: {
  ingredient: WithId<Ingredient> | undefined;
  onClose: () => void;
}) {
  const id = ingredient?.id;
  const [state, setState] = useState<{
    id: string;
    buys: WithId<IngredientBuy>[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    // hanya filter ingredient_id (tanpa orderBy) supaya tidak butuh index; urut di sisi client
    return onSnapshot(
      query(col<IngredientBuy>("ingredient_buys"), where("ingredient_id", "==", id)),
      (snap) => {
        const buys = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis());
        setState({ id, buys });
      },
      () => setState({ id, buys: [] }),
    );
  }, [id]);

  const buys = state && state.id === id ? state.buys : null;
  const totalSpent = buys?.reduce((s, b) => s + b.price, 0) ?? 0;
  const totalAmount = buys?.reduce((s, b) => s + b.amount, 0) ?? 0;
  const cheapest = buys?.reduce<WithId<IngredientBuy> | null>(
    (best, b) => (best === null || b.unit_price < best.unit_price ? b : best),
    null,
  );

  return (
    <Dialog open={!!ingredient} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Riwayat beli {ingredient?.name}</DialogTitle>
      <DialogContent className="flex flex-col gap-3 !pt-2">
        {buys === null ? (
          <Typography variant="body2" color="text.secondary">
            Memuat...
          </Typography>
        ) : buys.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Belum ada pembelian untuk bahan ini.
          </Typography>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Typography variant="caption" color="text.secondary">
                  Total belanja ({buys.length}×)
                </Typography>
                <Typography className="!text-sm !font-semibold">
                  {rupiah(totalSpent)} · {totalAmount} {ingredient?.unit}
                </Typography>
              </div>
              {cheapest && (
                <div>
                  <Typography variant="caption" color="text.secondary">
                    Termurah per {ingredient?.unit}
                  </Typography>
                  <Typography className="!text-sm !font-semibold">
                    {rupiah(cheapest.unit_price)}
                    {cheapest.store ? ` · ${cheapest.store}` : ""}
                  </Typography>
                </div>
              )}
            </div>
            <Divider />
            <div className="flex flex-col gap-3">
              {buys.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Typography className="!text-sm !font-semibold">
                      {b.store || "Toko tidak dicatat"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {b.created_at.toDate().toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {b.amount} {ingredient?.unit}
                    </Typography>
                  </div>
                  <div className="text-right">
                    <Typography className="!text-sm !font-semibold">
                      {rupiah(b.price)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rupiah(b.unit_price)}/{ingredient?.unit}
                    </Typography>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Tutup</Button>
      </DialogActions>
    </Dialog>
  );
}
