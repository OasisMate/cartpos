/**
 * Which organization is an /api/org/* request acting on?
 *
 * The old answer was always the `currentOrgId` cookie, which is one global value
 * per browser. A platform admin (or a multi-org owner) can sit on
 * /org/<A>/users while the cookie still points at org B, and the page then
 * listed B's staff under A's name. Org-scoped pages now send ?orgId=<A> taken
 * from their route params, and the URL wins.
 *
 * This only picks the target org. Callers must still run the resolved id
 * through their normal permission check, so it never grants access on its own.
 */
export function resolveOrgId(
  user: { currentOrgId?: string | null } | null,
  request?: Request,
  bodyOrgId?: string | null
): string | null {
  let fromQuery: string | null = null
  if (request) {
    try {
      fromQuery = new URL(request.url).searchParams.get('orgId')
    } catch {
      fromQuery = null
    }
  }
  return fromQuery || bodyOrgId || user?.currentOrgId || null
}
