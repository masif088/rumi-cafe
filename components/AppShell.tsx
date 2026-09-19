"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import AppBar from "@mui/material/AppBar";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/PeopleAltOutlined";
import PointOfSaleIcon from "@mui/icons-material/PointOfSaleOutlined";
import KitchenIcon from "@mui/icons-material/Inventory2Outlined";
import WalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import LocalCafeIcon from "@mui/icons-material/LocalCafeOutlined";
import { auth } from "@/lib/firebase";
import { collections } from "@/lib/db";
import { useCollection, useUser } from "@/lib/hooks";
import { isLow } from "@/lib/stock";
import type { Ingredient } from "@/lib/types";

const links = [
  { href: "/", label: "Kasir", icon: <PointOfSaleIcon /> },
  { href: "/transaksi", label: "Transaksi", icon: <ReceiptIcon /> },
  { href: "/cashflow", label: "Cash Flow", icon: <WalletIcon /> },
  { href: "/produk", label: "Produk", icon: <LocalCafeIcon /> },
  { href: "/bahan", label: "Bahan", icon: <KitchenIcon /> },
  { href: "/pelanggan", label: "Pelanggan", icon: <PeopleIcon /> },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { items: ingredients } = useCollection<Ingredient>(
    collections.ingredients,
  );
  const lowCount = ingredients.filter((i) => !i.hidden && isLow(i)).length;
  const iconFor = (l: (typeof links)[number]) =>
    l.href === "/bahan" && lowCount > 0 ? (
      <Badge badgeContent={lowCount} color="warning">
        {l.icon}
      </Badge>
    ) : (
      l.icon
    );

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  const active = links.find((l) =>
    l.href === "/" ? pathname === "/" : pathname.startsWith(l.href),
  );

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        className="border-b border-[var(--mui-palette-divider)] !bg-[var(--mui-palette-background-paper)]"
      >
        <Toolbar className="mx-auto w-full max-w-6xl gap-2 !px-4">
          <div className="flex flex-1 items-center gap-2 md:flex-none">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--mui-palette-primary-main)] text-[var(--mui-palette-primary-contrastText)]">
              <LocalCafeIcon fontSize="small" />
            </span>
            <Typography component="h1" className="!text-lg !font-bold !tracking-tight">
              Rumi Cafe
            </Typography>
          </div>

          {/* tablet ke atas: menu di bar atas */}
          <nav className="ml-6 hidden flex-1 gap-1 md:flex">
            {links.map((l) => {
              const on = active?.href === l.href;
              return (
                <Button
                  key={l.href}
                  component={Link}
                  href={l.href}
                  startIcon={iconFor(l)}
                  color={on ? "primary" : "inherit"}
                  variant={on ? "contained" : "text"}
                  className={on ? "" : "!text-[var(--mui-palette-text-secondary)]"}
                >
                  {l.label}
                </Button>
              );
            })}
          </nav>

          <IconButton aria-label="Keluar" onClick={() => signOut(auth)}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 md:pb-8">
        {children}
      </main>

      {/* mobile: navbar bawah */}
      <Paper
        elevation={0}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--mui-palette-divider)] md:hidden"
        square
      >
        <BottomNavigation showLabels value={active?.href ?? false}>
          {links.map((l) => (
            <BottomNavigationAction
              key={l.href}
              component={Link}
              href={l.href}
              className="!min-w-0 !px-0.5"
              value={l.href}
              label={l.label}
              icon={iconFor(l)}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </>
  );
}
