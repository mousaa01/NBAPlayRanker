"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      const hasSession = !!session;
      setCanReset(hasSession);
      setSessionChecked(true);

      if (!hasSession) {
        setMessage("This reset link is invalid or expired. Request a new reset email.");
        setSuccess(false);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setSuccess(false);

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      setSuccess(false);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully. Redirecting to home...");
    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  return (
    <section className="auth-page">
      <div className="auth-shell">
        <div className="auth-stage">
          <div className="auth-badge">NBA Play Ranker • New password</div>

          <h1 className="auth-title">Create a new password.</h1>

          <p className="auth-copy">
            Choose a new password for your account. Once saved, your workspace access will continue with the updated credentials.
          </p>
        </div>

        <div className="auth-panel">
          <div className="auth-panel-kicker">Reset password</div>
          <h2 className="auth-panel-title">Set your new password</h2>
          <p className="auth-panel-copy">
            Use at least 8 characters and make sure both fields match.
          </p>

          {!sessionChecked ? (
            <div className="auth-alert auth-alert-success">Checking your reset session...</div>
          ) : canReset ? (
            <form className="auth-form" onSubmit={handleUpdatePassword}>
              <label className="auth-field">
                <span className="auth-label">New password</span>

                <div className="auth-input-wrap">
                  <input
                    className="auth-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />

                  <button
                    type="button"
                    className="auth-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <label className="auth-field">
                <span className="auth-label">Confirm new password</span>
                <input
                  className="auth-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          ) : null}

          {message ? (
            <div className={`auth-alert ${success ? "auth-alert-success" : "auth-alert-error"}`}>
              {message}
            </div>
          ) : null}

          {!canReset && sessionChecked ? (
            <div className="auth-panel-note">
              Need another link? <Link href="/forgot-password">Request a new reset email</Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}