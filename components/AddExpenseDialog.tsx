"use client";

import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { addItem, collections } from "@/lib/db";
import { categoryLabels } from "@/lib/expense";
import type { Expense, ExpenseCategory } from "@/lib/types";

const today = () => new Date().toLocaleDateString("sv-SE"); // yyyy-mm-dd lokal

/** Form catat pengeluaran umum (gaji, sewa, listrik, dll). */
export default function AddExpenseDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("lainnya");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await addItem<Expense>(collections.expenses, {
        name: name.trim(),
        category,
        amount: Number(amount),
        // jam 12 siang lokal, supaya aman dari geseran zona waktu
        date: Timestamp.fromDate(new Date(`${date}T12:00:00`)),
      });
      setName("");
      setAmount("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Tambah pengeluaran</DialogTitle>
        <DialogContent className="flex flex-col gap-4 !pt-2">
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Keterangan"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            select
            label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {Object.entries(categoryLabels)
              .filter(([value]) => value !== "bahan")
              .map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              type="number"
              label="Jumlah (Rp)"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 1, inputMode: "numeric" } }}
            />
            <TextField
              type="date"
              label="Tanggal"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            Simpan
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
