"use client";

import Chip from "@mui/material/Chip";

/** Baris chip kategori (bisa digeser di layar kecil). value "all" = semua. */
export default function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (categories.length < 2) return null;
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {["all", ...categories].map((c) => (
        <Chip
          key={c}
          label={c === "all" ? "Semua" : c}
          color={value === c ? "primary" : "default"}
          variant={value === c ? "filled" : "outlined"}
          onClick={() => onChange(c)}
          className="shrink-0"
        />
      ))}
    </div>
  );
}
