import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  CalendarRange,
  Settings,
  ScrollText,
  Menu,
  Moon,
  Sun,
  LogOut,
  School,
  PenLine,
  Table2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/lib/auth";
import { useSchoolSettings } from "@/lib/queries";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Users; adminOnly?: boolean };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/marks", label: "Marks Entry", icon: PenLine },
  { to: "/marklists", label: "Marklists", icon: Table2 },
  { to: "/reports", label: "Report Cards", icon: FileText },
  { to: "/learners", label: "Manage Learners", icon: Users, adminOnly: true },
  { to: "/teachers", label: "Manage Teachers", icon: UserCog, adminOnly: true },
  { to: "/curriculum", label: "Grades & Subjects", icon: BookOpen, adminOnly: true },
  { to: "/exams", label: "Exams", icon: CalendarRange, adminOnly: true },
  { to: "/settings", label: "School Settings", icon: Settings, adminOnly: true },
  { to: "/activity", label: "Activity Log", icon: ScrollText, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { membership } = useMembership();
  const { data: settings } = useSchoolSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => setTheme(getStoredTheme()), []);
  useEffect(() => setOpen(false), [pathname]);

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const visible = navItems.filter((item) => !item.adminOnly || membership?.isAdmin);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt="School logo"
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-sidebar-accent">
              <School className="h-5 w-5 text-sidebar-primary" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {settings?.school_name || "Sikinter Primary and Junior School"}
            </p>
            <p className="text-xs text-sidebar-primary">Marks System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visible.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <p className="truncate px-1 text-xs text-sidebar-foreground/70">
            {membership?.fullName || membership?.email}
          </p>
          <p className="px-1 text-xs text-sidebar-primary">
            {membership?.isAdmin ? "Administrator" : membership?.isTeacher ? "Teacher" : "No role yet"}
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
          <GlobalSearch />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
          Powered by Sikinter Marks System
        </footer>
      </div>
    </div>
  );
}
