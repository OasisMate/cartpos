import { SignJWT, jwtVerify } from 'jose'

/**
 * Signed, shareable tokens for public receipt links (/r/<token>).
 * Uses the same JWT_SECRET as sessions, but a distinct `typ` claim so a
 * receipt token can never be mistaken for a session and vice-versa.
 * No expiry: a receipt is a permanent record the customer may revisit.
 * The signature makes invoice ids unguessable — there is no enumeration.
 */
const secretKey = process.env.JWT_SECRET
if (!secretKey || secretKey.length < 32) {
  throw new Error('JWT_SECRET must be set to a strong value (at least 32 characters).')
}
const encodedKey = new TextEncoder().encode(secretKey)

export async function signReceiptToken(invoiceId: string): Promise<string> {
  return new SignJWT({ typ: 'receipt', invoiceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(encodedKey)
}

export async function verifyReceiptToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] })
    if (payload.typ !== 'receipt' || !payload.invoiceId) return null
    return payload.invoiceId as string
  } catch {
    return null
  }
}
