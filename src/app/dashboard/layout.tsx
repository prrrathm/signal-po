import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { auth } from '@/auth'
import { logout } from '@/app/actions/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-gray-50 flex flex-col shrink-0">
        <div className="px-4 py-5">
          <h1 className="font-bold text-lg tracking-tight">Signal PO</h1>
          <p className="text-xs text-gray-500 mt-0.5">PO Triage System</p>
        </div>
        <Separator />
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <span>🎯</span> Action Center
          </Link>
          <Link
            href="/dashboard/emails"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <span>📨</span> Ingest Email
          </Link>
        </nav>
        <Separator />
        {/* User info + sign out */}
        <div className="px-3 py-3 space-y-2">
          <div className="px-2">
            <p className="text-xs font-medium text-gray-700 truncate">{user?.name ?? user?.email}</p>
            {user?.name && (
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            )}
          </div>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-gray-500 hover:text-gray-900 h-8 text-xs px-2"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
