"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { auth } from "@/lib/firebase";

const errorMessages: Record<string, string> = {
  "auth/invalid-credential": "Email atau password salah.",
  "auth/email-already-in-use": "Email sudah terdaftar.",
  "auth/weak-password": "Password minimal 6 karakter.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/operation-not-allowed":
    "Metode Email/Password belum diaktifkan di Firebase Console.",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(errorMessages[code] ?? "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Paper
        component="form"
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 p-6"
      >
        <Typography variant="h5" component="h1" className="font-semibold">
          {isLogin ? "Masuk ke Rumi Cafe" : "Daftar akun"}
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
        />

        <Button type="submit" variant="contained" size="large" disabled={loading}>
          {loading ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setMode(isLogin ? "register" : "login");
            setError("");
          }}
        >
          {isLogin ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </Button>
      </Paper>
    </main>
  );
}
