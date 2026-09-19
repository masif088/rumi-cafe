"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";

/** warna utama per mode, dipakai juga oleh grafik (SVG tidak bisa baca CSS var dengan andal) */
export const brand = { light: "#6F4E37", dark: "#D9A066" };

const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brand.light, contrastText: "#fff" },
        secondary: { main: "#C8894B" },
        background: { default: "#FAF6F1", paper: "#FFFFFF" },
        text: { primary: "#2B1D14", secondary: "#7A6656" },
        divider: "#EADFD3",
      },
    },
    dark: {
      palette: {
        primary: { main: brand.dark, contrastText: "#1A120B" },
        secondary: { main: "#E8B77F" },
        background: { default: "#14100C", paper: "#1E1813" },
        text: { primary: "#F3E9DD", secondary: "#B5A08C" },
        divider: "#33291F",
      },
    },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: 20 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTextField: { defaultProps: { size: "medium" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 24 } },
    },
  },
});

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
