import { NavLink, Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ROLE_LABEL, canSeePage, type PageKey } from "@/lib/access";
import { useCurrentAccess } from "@/lib/access-context";

const ALL_NAV = [
  { to: "/dashboard", page: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { to: "/members", page: "members", label: "Members", icon: MembersIcon },
  { to: "/enquiries", page: "enquiries", label: "Enquiries", icon: EnquiriesIcon },
  { to: "/newsletter", page: "newsletter", label: "Newsletter", icon: NewsletterIcon },
  { to: "/website", page: "website", label: "Website", icon: WebsiteIcon },
  { to: "/team", page: "team", label: "Team", icon: TeamIcon },
] as const;

export function Layout({ session }: { session: Session }) {
  const access = useCurrentAccess();
  const NAV = ALL_NAV.filter((n) =>
    n.page === "team" ? access.role === "admin" : canSeePage(access, n.page as PageKey),
  );
  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <img src={`${import.meta.env.BASE_URL}asme-mark.svg`} alt="ASME" className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">ASME</div>
            <div className="text-[11px] text-slate-400">Society CRM</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-wash text-brand-deep"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="truncate px-2 text-xs font-medium text-slate-600" title={session.user.email ?? ""}>
            {session.user.email}
          </div>
          <div className="px-2 text-[11px] text-slate-400">{ROLE_LABEL[access.role]}</div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <img src={`${import.meta.env.BASE_URL}asme-mark.svg`} alt="ASME" className="h-6 w-6" />
            ASME CRM
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm font-medium text-slate-600"
          >
            Sign out
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:hidden">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                  isActive ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* Inline SVG icons keep the bundle free of an icon dependency. */
function iconProps() {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}
function DashboardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}
function MembersIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function EnquiriesIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function NewsletterIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}
function WebsiteIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function TeamIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  );
}
