"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { voidTransaction } from "@/lib/db";
import { rupiah } from "@/lib/format";
import type { Transaction, WithId } from "@/lib/types";

/** Batalkan transaksi: stok kembali, ringkasan harian dan statistik pelanggan dikoreksi. */
export default function VoidTransactionDialog({
  trx,
  onClose,
}: {
  trx: WithId<Transaction> | undefined;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    setReason("");
    setError("");
    onClose();
  }

  async function confirm() {
    if (!trx) return;
    setError("");
    setBusy(true);
    try {
      await voidTransaction(trx.id, reason.trim());
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!trx} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Batalkan transaksi?</DialogTitle>
      <DialogContent className="flex flex-col gap-3">
        <DialogContentText>
          Transaksi {trx ? rupiah(trx.total) : ""} akan ditandai dibatalkan,
          stok bahan dikembalikan, dan angka omzet, laba, serta statistik
          pelanggan dikoreksi. Datanya tetap tersimpan sebagai riwayat.
        </DialogContentText>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          size="small"
          label="Alasan (opsional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Tidak</Button>
        <Button color="error" variant="contained" disabled={busy} onClick={confirm}>
          Batalkan transaksi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
