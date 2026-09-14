import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const ROLES = ["admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "Full access, plus managing the team",
  editor: "Read and set member status; read enquiries",
  viewer: "Read-only",
};

export type Access = {
  loading: boolean;
  /** Allowed to use the CRM at all. */
  allowed: boolean;
  role: Role;
  email: string;
  /** True when the crm_team table does not exist yet (team.sql not run). We
   *  fail open in that case so the first admin is never locked out, and the UI
   *  shows a one-time setup nudge instead of denying access. */
  setupPending: boolean;
};

/** Postgres "undefined table" — crm_team not created yet. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || /relation .*crm_team.* does not exist/i.test(err.message ?? "");
}

export function useAccess(session: Session): Access {
  const email = session.user.email ?? "";
  const [access, setAccess] = useState<Access>({
    loading: true,
    allowed: false,
    role: "viewer",
    email,
    setupPending: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("crm_team")
        .select("role, active")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      if (cancelled) return;

      if (isMissingTable(error)) {
        // Team system not set up yet: let the signed-in user in as admin so the
        // very first person can run setup and add others.
        setAccess({ loading: false, allowed: true, role: "admin", email, setupPending: true });
        return;
      }
      if (error) {
        setAccess({ loading: false, allowed: false, role: "viewer", email, setupPending: false });
        return;
      }
      const allowed = Boolean(data?.active);
      setAccess({
        loading: false,
        allowed,
        role: (data?.role as Role) ?? "viewer",
        email,
        setupPending: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return access;
}

export const canManageTeam = (role: Role) => role === "admin";
export const canEdit = (role: Role) => role === "admin" || role === "editor";
