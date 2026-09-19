"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import { removeRecipeItem, setRecipeItem } from "@/lib/db";
import { rupiah } from "@/lib/format";
import type { Ingredient, Product, ProductIngredient, WithId } from "@/lib/types";

/** Lihat, tambah, ubah jumlah, dan buang bahan dari resep sebuah produk. */
export default function RecipeDialog({
  product,
  recipe,
  ingredients,
  onClose,
}: {
  product: WithId<Product> | undefined;
  recipe: WithId<ProductIngredient>[];
  ingredients: WithId<Ingredient>[];
  onClose: () => void;
}) {
  const [ingredientId, setIngredientId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const rows = recipe.filter((r) => r.product_id === product?.id);
  const selected = byId.get(ingredientId);

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setIngredientId("");
    setAmount("");
    setError("");
    onClose();
  }

  return (
    <Dialog open={!!product} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Resep {product?.name}</DialogTitle>
      <DialogContent className="flex flex-col gap-3 !pt-2">
        {error && <Alert severity="error">{error}</Alert>}

        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Belum ada bahan di resep ini.
          </Typography>
        ) : (
          <div className="flex flex-col gap-1">
            {rows.map((r) => {
              const ing = byId.get(r.ingredient_id);
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Typography className="!truncate !text-sm !font-semibold">
                      {ing?.name ?? "Bahan dihapus"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.amount} {ing?.unit}
                      {ing ? ` · ${rupiah(r.amount * ing.value)}` : ""}
                    </Typography>
                  </div>
                  <IconButton
                    size="small"
                    aria-label={`Buang ${ing?.name ?? "bahan"}`}
                    disabled={busy}
                    onClick={() =>
                      run(() => removeRecipeItem(r.id, product!.id))
                    }
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </div>
              );
            })}
            <Typography variant="body2" className="!mt-1 !font-semibold">
              HPP: {rupiah(product?.hpp ?? 0)}
            </Typography>
          </div>
        )}

        <Divider />
        <Typography variant="body2" color="text.secondary">
          Tambah bahan (pilih bahan yang sudah ada untuk mengubah jumlahnya)
        </Typography>
        <TextField
          select
          size="small"
          label="Bahan"
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
        >
          {ingredients
            .filter((i) => !i.hidden)
            .map((i) => (
              <MenuItem key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </MenuItem>
            ))}
        </TextField>
        <TextField
          size="small"
          type="number"
          label={`Jumlah per 1 produk${selected ? ` (${selected.unit})` : ""}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          slotProps={{ htmlInput: { min: 0, step: "any" } }}
        />
        <Button
          variant="contained"
          disabled={busy || !ingredientId || !(Number(amount) > 0)}
          onClick={() =>
            run(async () => {
              await setRecipeItem(product!.id, ingredientId, Number(amount));
              setIngredientId("");
              setAmount("");
            })
          }
        >
          Simpan bahan
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Tutup</Button>
      </DialogActions>
    </Dialog>
  );
}
