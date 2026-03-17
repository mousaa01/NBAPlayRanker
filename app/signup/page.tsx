"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"coach" | "analyst">("coach");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Check your email to verify your account.");
  }

  return (
    <section className="card">
      <h1>Create account</h1>

      <form onSubmit={handleSignup} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
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
          minLength={8}
        />

        <select value={role} onChange={(e) => setRole(e.target.value as "coach" | "analyst")}>
          <option value="coach">Coach</option>
          <option value="analyst">Analyst</option>
        </select>

        <button type="submit" className="btn primary">Sign up</button>
      </form>

      {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}

      <p className="muted" style={{ marginTop: 12 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}