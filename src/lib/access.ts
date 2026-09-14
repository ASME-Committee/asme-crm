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
  admin: "Full access + manage the team (sees every page)",
  editor: "Can set member status on the pages they're given",
  viewer: "Read-only on the pages they're given",
};

/** The pages an admin can share with a member. "Team" is admin-only and not
 *  listed here. Keys match the crm_team.pages values and the route paths. */
export const PAGES = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "members", label: "Members", path: "/members" },
  { key: "enquiries", label: "Enquiries", path: "/enquiries" },
  { key: "website", label: "Website", path: "/website" },
] as const;
export type PageKey = (typeof PAGES)[number]["key"];
export const PAGE_KEYS = PAGES.map((p) => p.key) as PageKey[];
export const PAGE_LABEL: Record<PageKey, string> = Object.fromEntries(
  PAGES.map((p) => [p.key, p.label]),
) as Record<PageKey, string>;

export type Access = {
  loading: boolean;
  allowed: boolean;
  role: Role;
  /** Pages this member may see. null = all (admins, or a row with no page list). */
  pages: PageKey[] | null;
  email: string;
  setupPending: boolean;
};

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || /relation .*crm_team.* does not exist/i.test(err.message ?? "");
}

/** The `pages` column exists only after team-pages.sql runs; tolerate its
 *  absence so nobody is locked out in the window before that SQL is applied. */
function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42703" || /column .* does not exist/i.test(err.message ?? "");
}

export function useAccess(session: Session): Access {
  const email = session.user.email ?? "";
  const [access, setAccess] = useState<Access>({
    loading: true,
    allowed: false,
    role: "viewer",
    pages: null,
    email,
    setupPending: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let { data, error } = await supabase
        .from("crm_team")
        .select("role, active, pages")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      // Before team-pages.sql, the pages column is absent — retry without it.
      if (isMissingColumn(error)) {
        ({ data, error } = await supabase
          .from("crm_team")
          .select("role, active")
          .eq("email", email.toLowerCase())
          .maybeSingle());
      }
      if (cancelled) return;

      if (isMissingTable(error)) {
        setAccess({ loading: false, allowed: true, role: "admin", pages: null, email, setupPending: true });
        return;
      }
      if (error) {
        setAccess({ loading: false, allowed: false, role: "viewer", pages: null, email, setupPending: false });
        return;
      }
      const allowed = Boolean(data?.active);
      if (allowed) {
        // Fire-and-forget: mark this member seen so the roster shows Active.
        // Ignores errors (e.g. before team-pages.sql is run).
        supabase.rpc("crm_mark_seen").then(() => {}, () => {});
      }
      setAccess({
        loading: false,
        allowed,
        role: (data?.role as Role) ?? "viewer",
        pages: (data?.pages as PageKey[] | null) ?? null,
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

/** Whether this member may see a given page. Admins and rows with no page list
 *  see everything. */
export function canSeePage(access: Pick<Access, "role" | "pages">, key: PageKey): boolean {
  if (access.role === "admin") return true;
  if (!access.pages) return true;
  return access.pages.includes(key);
}

/** The first page this member is allowed to land on. */
export function firstAllowedPath(access: Pick<Access, "role" | "pages">): string {
  const page = PAGES.find((p) => canSeePage(access, p.key));
  return page ? page.path : "/dashboard";
}
