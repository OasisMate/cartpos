import { NextResponse } from 'next/server'

/**
 * Demo/test-fixture orgs (Organization.isDemo) allow normal everyday use — making sales,
 * adding products/customers, recording payments — so the demo feels real, but DESTRUCTIVE
 * actions are blocked org-wide so the fixture stays intact and reusable. Call this at the top
 * of every destructive route handler after loading the user.
 *
 * The reset baseline lives in scripts/reset-demo-org.ts (runs server-side, bypassing this guard).
 */
export const DEMO_BLOCKED_CODE = 'DEMO_READONLY'

/** True if the user is acting inside a demo org. */
export function isDemoUser(user: { isDemoOrg?: boolean } | null | undefined): boolean {
  return !!user?.isDemoOrg
}

/** Standard 403 for a destructive action attempted in a demo org. */
export function DemoBlockedResponse() {
  return NextResponse.json(
    { error: 'Demo mode: destructive actions are disabled.', code: DEMO_BLOCKED_CODE },
    { status: 403 }
  )
}
