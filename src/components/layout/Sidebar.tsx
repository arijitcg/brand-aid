import { NavLink } from "react-router-dom";
import { LayoutDashboard, Sparkles, Settings, Radar, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { isLive } from "@/lib/dataStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/new", label: "New Analysis", icon: Sparkles, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function Sidebar() {
  const { user, signOut } = useAuth();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Radar className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Brand Aid</p>
          <p className="text-[11px] leading-tight text-sidebar-foreground/50">Competitor Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between rounded-lg bg-sidebar-accent/40 px-3 py-2 text-xs">
          <span className="text-sidebar-foreground/70">Data mode</span>
          <span className={cn("font-semibold", isLive ? "text-success" : "text-amber-400")}>
            {isLive ? "Live" : "Demo"}
          </span>
        </div>
        {user && (
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="truncate text-xs text-sidebar-foreground/60">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="rounded p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
