import { requireAdminPage } from "@/lib/page-auth";
import { Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { RoleSelect } from "@/components/admin/role-select";
import { DeleteButton } from "@/components/admin/delete-button";
import { formatRelativeTime } from "@aninusa/utils";

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireAdminPage("/admin/users");
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  const current = await getSessionUser();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { favorites: true, watchHistory: true } },
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Pengguna</h1>
        <p className="mt-0.5 text-sm text-white/45">
          {users.length} pengguna ditampilkan. Hanya ADMIN yang dapat mengubah peran atau menghapus akun.
        </p>
      </header>

      <form className="relative max-w-md" action="/admin/users" method="get">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari username atau email..."
          aria-label="Cari pengguna"
          className="input pl-9"
        />
      </form>

      <div className="surface overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-3 py-2.5 font-medium">Pengguna</th>
              <th className="px-3 py-2.5 font-medium">Peran</th>
              <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Aktivitas</th>
              <th className="hidden px-3 py-2.5 font-medium md:table-cell">Bergabung</th>
              <th className="px-3 py-2.5 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2.5">
                  <p className="font-medium text-white/90">{user.username}</p>
                  <p className="text-[11px] text-white/35">{user.email}</p>
                </td>
                <td className="px-3 py-2.5">
                  <RoleSelect
                    userId={user.id}
                    role={user.role}
                    disabled={current?.role !== "ADMIN" || current.id === user.id}
                  />
                </td>
                <td className="hidden px-3 py-2.5 text-[11px] text-white/45 sm:table-cell">
                  {user._count.favorites} favorit ?? {user._count.watchHistory} riwayat
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-[11px] text-white/35 md:table-cell">
                  {formatRelativeTime(user.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {current?.role === "ADMIN" && current.id !== user.id ? (
                    <DeleteButton
                      endpoint={`/api/admin/users/${user.id}`}
                      confirmMessage={`Hapus akun ${user.username}? Favorit dan riwayat ikut terhapus.`}
                      label=""
                    />
                  ) : (
                    <span className="text-[10px] text-white/25">???</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-xs text-white/40">
                  Tidak ada pengguna yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


