"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.push(next || (profile?.role === "coach" ? "/matchup" : "/data-explorer"));
    router.refresh();
  }

  return (
    <section className="card">
      <h1>Log in</h1>

      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="btn primary">Log in</button>
      </form>

      {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}

      <p className="muted" style={{ marginTop: 12 }}>
        Need an account? <Link href="/signup">Sign up</Link>
      </p>
    </section>
  );
}