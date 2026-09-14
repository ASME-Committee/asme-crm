import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function LoginPage() {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setError(error.message);
    else setSent(true);
    setBusy(false);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-brand-wash px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <img
            src={`${import.meta.env.BASE_URL}asme-mark.svg`}
            alt="ASME"
            className="mx-auto mb-3 h-12 w-12"
          />
          <div className="text-lg font-semibold tracking-tight text-ink">ASME Society CRM</div>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage members and enquiries</p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
            Check your inbox — we sent a sign-in link to{" "}
            <span className="font-medium">{email}</span>.
          </div>
        ) : (
          <form onSubmit={mode === "password" ? signInPassword : sendMagicLink} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            {mode === "password" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-deep disabled:opacity-50"
            >
              {busy
                ? "Working…"
                : mode === "password"
                  ? "Sign in"
                  : "Email me a sign-in link"}
            </button>
          </form>
        )}

        {!sent && (
          <button
            onClick={() => {
              setMode(mode === "password" ? "magic" : "password");
              setError(null);
            }}
            className="mt-4 w-full text-center text-xs font-medium text-brand-deep hover:underline"
          >
            {mode === "password"
              ? "First time? Email me a sign-in link instead"
              : "Sign in with a password instead"}
          </button>
        )}
      </div>
    </div>
  );
}
