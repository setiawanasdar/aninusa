import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  BookOpen,
  Database,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { getSessionUser, isAdminRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dasbor", icon: LayoutDashboard },
  { href: "/admin/anime", label: "Anime", icon: Database },
  { href: "/admin/manga", label: "Manga & Komik", icon: BookOpen },
  { href: "/admin/providers", label: "Provider & sinkronisasi", icon: Activity },
  { href: "/admin/health", label: "Kesehatan sumber", icon: Video },
  { href: "/admin/users", label: "Pengguna", icon: Users },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminRole(user.role)) redirect("/");

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/[0.07] px-4 py-2.5 text-xs font-medium text-accent">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Area admin — semua tindakan dicatat di audit log.
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside>
          <nav className="surface sticky top-20 space-y-1 p-2" aria-label="Navigasi admin">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
