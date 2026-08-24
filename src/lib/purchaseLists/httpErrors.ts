import { NextResponse } from 'next/server'

/**
 * Maps a thrown error from src/lib/domain/purchaseLists.ts to an HTTP
 * response, following the convention set by
 * src/app/api/quotations/[id]/cancel/route.ts: permission errors are 403,
 * "not found" errors are 404. Beyond that we go one step further than that
 * file: only the validation errors this domain module is known to throw map
 * to 400, everything else is unexpected and comes back as a generic 500
 * with the real error logged server-side (never leaked to the client).
 */
const KNOWN_VALIDATION_ERRORS = [
  'Invalid supplier',
  'This list has already been received',
  'A list becomes received by receiving it, not by editing it',
  'Quantity must be greater than 0',
  'A received list is history and cannot be deleted',
]

export function purchaseListErrorResponse(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : ''

  if (/permission/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 403 })
  }
  if (/not found/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 })
  }
  if (KNOWN_VALIDATION_ERRORS.some((known) => message.includes(known))) {
    return NextResponse.json({ error: message }, { status: 400 })
  }

  console.error(context, error)
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
}
