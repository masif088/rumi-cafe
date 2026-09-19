"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import LocalCafeIcon from "@mui/icons-material/LocalCafeOutlined";
import EmptyState from "@/components/EmptyState";
import FormDialog from "@/components/FormDialog";
import ItemMenu from "@/components/ItemMenu";
import CategoryFilter from "@/components/CategoryFilter";
import PageHeader from "@/components/PageHeader";
import RecipeDialog from "@/components/RecipeDialog";
import {
  addItem,
  collections,
  deleteProduct,
  updateItem,
  updateProductPrice,
} from "@/lib/db";
import { categoriesOf, categoryOf } from "@/lib/category";
import { rupiah } from "@/lib/format";
import { useCollection } from "@/lib/hooks";
import type { Ingredient, Product, ProductIngredient } from "@/lib/types";

type Dialog = { type: "recipe" | "price" | "edit"; id: string } | null;

export default function ProdukPage() {
  const { items, loading } = useCollection<Product>(collections.products);
  const { items: ingredients } = useCollection<Ingredient>(
    collections.ingredients,
  );
  const { items: recipes } = useCollection<ProductIngredient>(
    collections.productIngredients,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [cat, setCat] = useState("all");
  const categories = categoriesOf(items);
  const categoryField = {
    name: "category",
    label: "Kategori (ketik baru atau pilih)",
    type: "combo" as const,
    required: false,
    options: categories.map((c) => ({ value: c, label: c })),
  };
  const target = items.find((p) => p.id === dialog?.id);
  const visible = items.filter(
    (p) => (showHidden || !p.hidden) && (cat === "all" || categoryOf(p) === cat),
  );
  const hiddenCount = items.filter((p) => p.hidden).length;

  return (
    <>
      <PageHeader
        title="Produk"
        subtitle={`${items.length} produk`}
        onAdd={() => setAddOpen(true)}
      />

      <CategoryFilter categories={categories} value={cat} onChange={setCat} />

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
          icon={<LocalCafeIcon />}
          title="Belum ada produk"
          hint="Tambahkan menu, lalu isi resepnya supaya HPP terhitung."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const margin = p.price - p.hpp;
          return (
            <Card key={p.id} className={p.hidden ? "opacity-60" : ""}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Typography className="!font-bold">{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {categoryOf(p)}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.hidden && (
                      <Chip size="small" variant="outlined" label="Tersembunyi" />
                    )}
                    <Chip
                      size="small"
                      color={margin > 0 ? "success" : "warning"}
                      variant="outlined"
                      label={`Margin ${rupiah(margin)}`}
                    />
                    <ItemMenu
                      name={p.name}
                      hidden={p.hidden}
                      deleteHint="Resepnya ikut terhapus. Riwayat transaksi tidak berubah."
                      onEdit={() => setDialog({ type: "edit", id: p.id })}
                      onToggleHidden={() =>
                        updateItem(collections.products, p.id, { hidden: !p.hidden })
                      }
                      onDelete={() => deleteProduct(p.id)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Typography variant="caption" color="text.secondary">
                      Harga jual
                    </Typography>
                    <Typography className="!font-semibold">
                      {rupiah(p.price)}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" color="text.secondary">
                      HPP
                    </Typography>
                    <Typography className="!font-semibold">
                      {rupiah(p.hpp)}
                    </Typography>
                  </div>
                </div>
                <div>
                  <Typography variant="caption" color="text.secondary">
                    Resep
                  </Typography>
                  {recipes.filter((r) => r.product_id === p.id).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Belum ada bahan
                    </Typography>
                  ) : (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {recipes
                        .filter((r) => r.product_id === p.id)
                        .map((r) => {
                          const ing = ingredients.find(
                            (i) => i.id === r.ingredient_id,
                          );
                          return (
                            <Chip
                              key={r.id}
                              size="small"
                              variant="outlined"
                              label={`${ing?.name ?? "?"} ${r.amount}${ing?.unit ?? ""}`}
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setDialog({ type: "price", id: p.id })}
                  >
                    Ubah harga
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setDialog({ type: "recipe", id: p.id })}
                  >
                    Resep
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FormDialog
        open={addOpen}
        title="Tambah produk"
        onClose={() => setAddOpen(false)}
        fields={[
          { name: "name", label: "Nama produk" },
          { name: "price", label: "Harga jual (Rp)", type: "number" },
          categoryField,
        ]}
        onSubmit={async (v) => {
          await addItem<Product>(collections.products, {
            name: v.name.trim(),
            category: (v.category ?? "").trim(),
            price: Number(v.price),
            history_price: [],
            hpp: 0,
          });
        }}
      />
      <FormDialog
        open={dialog?.type === "edit"}
        title={`Edit ${target?.name ?? ""}`}
        initial={{
          name: target?.name ?? "",
          price: String(target?.price ?? ""),
          category: target?.category ?? "",
        }}
        onClose={() => setDialog(null)}
        fields={[
          { name: "name", label: "Nama produk" },
          { name: "price", label: "Harga jual (Rp)", type: "number" },
          categoryField,
        ]}
        onSubmit={async (v) => {
          if (!dialog || !target) return;
          await updateItem(collections.products, dialog.id, {
            name: v.name.trim(),
            category: (v.category ?? "").trim(),
          });
          if (Number(v.price) !== target.price)
            await updateProductPrice(dialog.id, Number(v.price));
        }}
      />
      <FormDialog
        open={dialog?.type === "price"}
        title={`Ubah harga ${target?.name ?? ""}`}
        onClose={() => setDialog(null)}
        fields={[{ name: "price", label: "Harga baru (Rp)", type: "number" }]}
        onSubmit={async (v) => {
          if (dialog) await updateProductPrice(dialog.id, Number(v.price));
        }}
      />
      <RecipeDialog
        product={dialog?.type === "recipe" ? target : undefined}
        recipe={recipes}
        ingredients={ingredients}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
