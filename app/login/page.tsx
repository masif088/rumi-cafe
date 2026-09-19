"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { auth } from "@/lib/firebase";

const errorMessages: Record<string, string> = {
  "auth/invalid-credential": "Email atau password salah.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
  "auth/operation-not-allowed":
    "Metode Email/Password belum diaktifkan di Firebase Console.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(errorMessages[code] ?? "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Paper
        component="form"
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 p-6"
      >
        <Typography variant="h5" component="h1" className="font-semibold">
          Masuk ke Rumi Cafe
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
          autoComplete="current-password"
          required
        />

        <Button type="submit" variant="contained" size="large" disabled={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </Button>
      </Paper>
    </main>
  );
}
