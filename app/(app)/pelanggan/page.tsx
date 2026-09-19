"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import PeopleIcon from "@mui/icons-material/PeopleAltOutlined";
import EmptyState from "@/components/EmptyState";
import FormDialog from "@/components/FormDialog";
import ItemMenu from "@/components/ItemMenu";
import PageHeader from "@/components/PageHeader";
import { addItem, collections, deleteItem, updateItem } from "@/lib/db";
import { useCollection } from "@/lib/hooks";
import type { Customer } from "@/lib/types";

export default function PelangganPage() {
  const { items, loading } = useCollection<Customer>(collections.customers);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const editing = items.find((c) => c.id === editId);
  const visible = items.filter((c) => showHidden || !c.hidden);
  const hiddenCount = items.filter((c) => c.hidden).length;

  return (
    <>
      <PageHeader
        title="Pelanggan"
        subtitle={`${items.length} pelanggan`}
        onAdd={() => setOpen(true)}
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
          title="Belum ada pelanggan"
          hint="Data pelanggan bersifat opsional saat transaksi."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <Card key={c.id} className={c.hidden ? "opacity-60" : ""}>
            <CardContent className="flex items-start gap-3">
              <Avatar className="!bg-[var(--mui-palette-primary-main)] !text-[var(--mui-palette-primary-contrastText)]">
                {c.full_name.charAt(0).toUpperCase()}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <Typography className="!font-bold">{c.full_name}</Typography>
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
                        updateItem(collections.customers, c.id, { hidden: !c.hidden })
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
                <Typography variant="body2" color="text.secondary">
                  {c.address}
                </Typography>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
        fields={[
          { name: "full_name", label: "Nama lengkap" },
          { name: "couple_name", label: "Nama pasangan", required: false },
          { name: "no_hp", label: "No. HP" },
          { name: "address", label: "Alamat" },
          { name: "address_blok", label: "Blok" },
        ]}
        onSubmit={async (v) => {
          if (editId) await updateItem(collections.customers, editId, v);
        }}
      />
      <FormDialog
        open={open}
        title="Tambah pelanggan"
        onClose={() => setOpen(false)}
        fields={[
          { name: "full_name", label: "Nama lengkap" },
          { name: "couple_name", label: "Nama pasangan", required: false },
          { name: "no_hp", label: "No. HP" },
          { name: "address", label: "Alamat" },
          { name: "address_blok", label: "Blok" },
        ]}
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
