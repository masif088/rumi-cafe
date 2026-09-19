"use client";

import { useMemo, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { RadarChart } from "@mui/x-charts/RadarChart";
import { brand } from "@/components/ThemeProvider";
import { rupiah } from "@/lib/format";
import type { Customer, DailyStat, WithId } from "@/lib/types";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

type Metric = "revenue" | "count";

/**
 * Tren per hari (radar) dari ringkasan harian 30 hari terakhir,
 * dan top pembeli dari total belanja yang tersimpan di dokumen pelanggan.
 * Keduanya tanpa membaca transaksi satu per satu.
 */
export default function TransaksiInsights({
  days,
  customers,
}: {
  days: WithId<DailyStat>[];
  customers: WithId<Customer>[];
}) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  const color = dark ? brand.dark : brand.light;

  const perDay = useMemo(() => {
    const revenue = Array(7).fill(0) as number[];
    const count = Array(7).fill(0) as number[];
    for (const d of days) {
      const i = (d.date.toDate().getDay() + 6) % 7; // Senin = 0
      revenue[i] += d.income ?? 0;
      count[i] += d.trx_count ?? 0;
    }
    return { revenue, count };
  }, [days]);

  const topBuyers = useMemo(
    () =>
      customers
        .filter((c) => (c.total_spent ?? 0) > 0)
        .sort((a, b) => (b.total_spent ?? 0) - (a.total_spent ?? 0))
        .slice(0, 5),
    [customers],
  );

  const data = perDay[metric];
  const peak = Math.max(...data);
  const bestDay = peak > 0 ? DAYS[data.indexOf(peak)] : null;
  const fmt = (v: number) => (metric === "revenue" ? rupiah(v) : `${v} transaksi`);
  const topMax = topBuyers[0]?.total_spent ?? 0;

  return (
    <div className="mb-5 grid gap-3 md:grid-cols-2">
      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Typography className="!font-bold">Tren per hari</Typography>
              <Typography variant="caption" color="text.secondary">
                30 hari terakhir
                {bestDay ? ` · paling ramai ${bestDay}` : ""}
              </Typography>
            </div>
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={metric}
              onChange={(_, v: Metric | null) => v && setMetric(v)}
            >
              <ToggleButton value="revenue">Omzet</ToggleButton>
              <ToggleButton value="count">Jumlah</ToggleButton>
            </ToggleButtonGroup>
          </div>

          {peak <= 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              className="py-16 text-center"
            >
              Belum ada transaksi dalam 30 hari terakhir.
            </Typography>
          ) : (
            <RadarChart
              height={300}
              colors={[color]}
              series={[
                {
                  label: metric === "revenue" ? "Omzet" : "Transaksi",
                  data,
                  valueFormatter: (v) => fmt(v ?? 0),
                  fillArea: true,
                },
              ]}
              radar={{ metrics: DAYS, max: peak }}
              hideLegend
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Typography className="!font-bold">Top pembeli</Typography>
            <Typography variant="caption" color="text.secondary">
              Sepanjang waktu, berdasarkan total belanja
            </Typography>
          </div>

          {topBuyers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" className="py-8">
              Belum ada transaksi dengan pelanggan terdaftar.
            </Typography>
          ) : (
            <ol className="flex flex-col gap-3">
              {topBuyers.map((c, i) => (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Typography className="!truncate !text-sm !font-semibold">
                      {i + 1}. {c.full_name}
                    </Typography>
                    <Typography className="!text-sm !font-semibold">
                      {rupiah(c.total_spent ?? 0)}
                    </Typography>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--mui-palette-divider)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${topMax ? ((c.total_spent ?? 0) / topMax) * 100 : 0}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <Typography variant="caption" color="text.secondary">
                    {c.trx_count ?? 0} transaksi
                  </Typography>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
