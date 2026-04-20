'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { TeamRole } from '@/db/schema'

type TeamWithRole = {
  id: string
  name: string
  slug: string
  role: TeamRole
}

export function TeamSwitcher({
  teams,
  activeTeamId,
}: {
  teams: TeamWithRole[]
  activeTeamId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? teams[0]

  async function switchTeam(teamId: string) {
    if (teamId === activeTeamId) {
      setOpen(false)
      return
    }

    setSwitching(true)
    try {
      await fetch('/api/teams/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      })
      setOpen(false)
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  if (teams.length === 0) return null

  return (
    <div className="relative px-3 pb-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between text-xs h-8 px-2 font-medium"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
      >
        <span className="truncate">{activeTeam?.name ?? 'Select team'}</span>
        <span className="ml-1 text-gray-400">▾</span>
      </Button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-md border bg-white shadow-md">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => switchTeam(team.id)}
              className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between ${
                team.id === activeTeamId ? 'font-semibold text-gray-900' : 'text-gray-700'
              }`}
            >
              <span className="truncate">{team.name}</span>
              <span className="ml-2 text-gray-400 text-[10px] uppercase">{team.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
