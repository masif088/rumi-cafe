"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PeopleIcon from "@mui/icons-material/PeopleAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CategoryFilter from "@/components/CategoryFilter";
import CustomerDetailDialog from "@/components/CustomerDetailDialog";
import EmptyState from "@/components/EmptyState";
import FormDialog from "@/components/FormDialog";
import ItemMenu from "@/components/ItemMenu";
import PageHeader from "@/components/PageHeader";
import { addItem, collections, deleteItem, updateItem } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { useCollection } from "@/lib/hooks";
import type { Customer } from "@/lib/types";

const customerFields = [
  { name: "full_name", label: "Nama lengkap" },
  { name: "couple_name", label: "Nama pasangan", required: false },
  { name: "no_hp", label: "No. HP" },
  { name: "address", label: "Alamat" },
  { name: "address_blok", label: "Blok" },
];

export default function PelangganPage() {
  const { items, loading } = useCollection<Customer>(collections.customers);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [blok, setBlok] = useState("all");

  const editing = items.find((c) => c.id === editId);
  const detail = items.find((c) => c.id === detailId);
  const hiddenCount = items.filter((c) => c.hidden).length;

  const bloks = [
    ...new Set(items.map((c) => c.address_blok?.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));

  const q = search.trim().toLowerCase();
  const visible = items.filter((c) => {
    if (!showHidden && c.hidden) return false;
    if (blok !== "all" && c.address_blok?.trim() !== blok) return false;
    if (!q) return true;
    return [c.full_name, c.couple_name, c.no_hp, c.address, c.address_blok]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  return (
    <>
      <PageHeader
        title="Pelanggan"
        subtitle={`${visible.length} dari ${items.length} pelanggan`}
        onAdd={() => setOpen(true)}
      />

      <TextField
        fullWidth
        size="small"
        placeholder="Cari nama, no. HP, atau alamat"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="!mb-3"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <CategoryFilter
        categories={bloks}
        value={blok}
        onChange={setBlok}
        format={(b) => `Blok ${b}`}
      />

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
          icon={<PeopleIcon />}
          title={items.length === 0 ? "Belum ada pelanggan" : "Tidak ditemukan"}
          hint={
            items.length === 0
              ? "Data pelanggan bersifat opsional saat transaksi."
              : "Coba kata kunci atau blok lain."
          }
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <Card key={c.id} className={c.hidden ? "opacity-60" : ""}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Avatar className="!bg-[var(--mui-palette-primary-main)] !text-[var(--mui-palette-primary-contrastText)]">
                  {c.full_name.charAt(0).toUpperCase()}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <Typography className="!truncate !font-bold">
                      {c.full_name}
                    </Typography>
                    <div className="flex items-center gap-1">
                      {c.hidden && (
                        <Chip size="small" variant="outlined" label="Tersembunyi" />
                      )}
                      <ItemMenu
                        name={c.full_name}
                        hidden={c.hidden}
                        deleteHint="Riwayat transaksi tetap ada."
                        onEdit={() => setEditId(c.id)}
                        onToggleHidden={() =>
                          updateItem(collections.customers, c.id, {
                            hidden: !c.hidden,
                          })
                        }
                        onDelete={() => deleteItem(collections.customers, c.id)}
                      />
                    </div>
                  </div>
                  {c.couple_name && (
                    <Typography variant="body2" color="text.secondary">
                      Pasangan: {c.couple_name}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {c.no_hp} · Blok {c.address_blok}
                  </Typography>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Typography variant="caption" color="text.secondary">
                    Total pembelian
                  </Typography>
                  <Typography className="!text-sm !font-semibold">
                    {rupiah(c.total_spent ?? 0)}
                  </Typography>
                </div>
                <div>
                  <Typography variant="caption" color="text.secondary">
                    Terakhir beli
                  </Typography>
                  <Typography className="!text-sm !font-semibold">
                    {c.last_purchase_at
                      ? c.last_purchase_at.toDate().toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })
                      : "-"}
                  </Typography>
                </div>
              </div>

              <Button variant="outlined" onClick={() => setDetailId(c.id)}>
                Lihat detail
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <CustomerDetailDialog customer={detail} onClose={() => setDetailId(null)} />

      <FormDialog
        open={!!editing}
        title={`Edit ${editing?.full_name ?? ""}`}
        initial={{
          full_name: editing?.full_name ?? "",
          couple_name: editing?.couple_name ?? "",
          no_hp: editing?.no_hp ?? "",
          address: editing?.address ?? "",
          address_blok: editing?.address_blok ?? "",
        }}
        onClose={() => setEditId(null)}
        fields={customerFields}
        onSubmit={async (v) => {
          if (editId) await updateItem(collections.customers, editId, v);
        }}
      />
      <FormDialog
        open={open}
        title="Tambah pelanggan"
        onClose={() => setOpen(false)}
        fields={customerFields}
        onSubmit={async (v) => {
          await addItem<Customer>(collections.customers, {
            full_name: v.full_name,
            couple_name: v.couple_name ?? "",
            no_hp: v.no_hp,
            address: v.address,
            address_blok: v.address_blok,
          });
        }}
      />
    </>
  );
}
