/**
 * Shown when someone signs in with a valid Supabase account but is not on the
 * ASME team allowlist (crm_team). Row-level security already blocks their data
 * access; this explains why and offers a way out.
 */
export function AccessDenied({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-brand-wash px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <img
          src={`${import.meta.env.BASE_URL}asme-mark.svg`}
          alt="ASME"
          className="mx-auto mb-3 h-12 w-12 opacity-60"
        />
        <h1 className="text-lg font-semibold text-ink">No access yet</h1>
        <p className="mt-2 text-sm text-slate-500">
          You're signed in as <span className="font-medium text-slate-700">{email}</span>, but this
          account isn't on the ASME team yet. Ask an admin to add you, then sign in again.
        </p>
        <button
          onClick={onSignOut}
          className="mt-5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
