/** PK numbers stored as 03xxxxxxxxx → wa.me wants international 92xxxxxxxxx. */
export function toWaNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return '92' + digits.slice(1)
  if (digits.startsWith('92')) return digits
  if (digits.length === 10) return '92' + digits // bare 3xxxxxxxxx
  return digits
}

/** Build a wa.me URL; if no valid number, opens the chooser so the user picks a contact. */
export function waUrl(phone: string | null | undefined, text: string): string {
  const wa = toWaNumber(phone)
  const encoded = encodeURIComponent(text)
  return wa ? `https://wa.me/${wa}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}
