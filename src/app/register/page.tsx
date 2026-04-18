'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { register } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Signal PO</h1>
          <p className="text-sm text-gray-500 mt-1">Purchase order triage system</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create account</CardTitle>
            <CardDescription>Set up your Signal PO account.</CardDescription>
          </CardHeader>
          <CardContent>
            {state?.error && (
              <div className="mb-4 px-3 py-2 rounded bg-red-50 text-red-700 text-sm">
                {state.error}
              </div>
            )}
            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="underline text-gray-900 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
