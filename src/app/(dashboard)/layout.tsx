import Link from 'next/link'
import { Separator } from '@/components/ui/separator'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <span>🎯</span> Action Center
          </Link>
          <Link
            href="/emails"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <span>📨</span> Ingest Email
          </Link>
        </nav>
        <Separator />
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">Next.js 16 · Drizzle · Claude</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
