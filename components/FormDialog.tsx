"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

export interface Field {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "combo";
  options?: { value: string; label: string }[];
  required?: boolean;
}

export default function FormDialog({
  open,
  title,
  fields,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  fields: Field[];
  initial?: Record<string, string>;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // nilai awal (mode edit) ditimpa oleh isian user
  const shown = { ...initial, ...values };

  function close() {
    setValues({});
    setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(shown);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent className="flex flex-col gap-4 !pt-2">
          {error && <Alert severity="error">{error}</Alert>}
          {fields.map((f) =>
            f.type === "combo" ? (
              // isian bebas + saran dari options
              <Autocomplete
                key={f.name}
                freeSolo
                options={f.options?.map((o) => o.value) ?? []}
                inputValue={shown[f.name] ?? ""}
                onInputChange={(_, v) => setValues({ ...values, [f.name]: v })}
                renderInput={(params) => (
                  <TextField {...params} label={f.label} required={f.required ?? true} />
                )}
              />
            ) : (
            <TextField
              key={f.name}
              label={f.label}
              select={f.type === "select"}
              type={f.type === "number" ? "number" : "text"}
              required={f.required ?? true}
              value={shown[f.name] ?? ""}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              slotProps={
                f.type === "number"
                  ? { htmlInput: { min: 0, step: "any" } }
                  : undefined
              }
            >
              {f.options?.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            ),
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Batal</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            Simpan
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
