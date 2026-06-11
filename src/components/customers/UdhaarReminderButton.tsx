'use client'

import { MessageCircle } from 'lucide-react'
import { formatNumber } from '@/lib/utils/money'
import { waUrl } from '@/lib/utils/whatsapp'

/**
 * Opens WhatsApp with a polite udhaar (outstanding balance) reminder for a customer.
 * Direct to their number if we have one, otherwise WhatsApp's contact chooser.
 */
export default function UdhaarReminderButton({
  name,
  phone,
  balance,
  shopName,
}: {
  name: string
  phone: string | null | undefined
  balance: number
  shopName?: string | null
}) {
  function handleClick() {
    const lines = [
      `Assalam o Alaikum ${name},`,
      shopName ? `Yeh ${shopName} ki taraf se reminder hai.` : 'Yeh ek reminder hai.',
      `Aap ka udhaar (baqaya) Rs.${formatNumber(balance)} hai.`,
      'Baraye meharbani jald adaigi kar dein. Shukriya!',
    ]
    window.open(waUrl(phone, lines.join('\n')), '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Send udhaar reminder on WhatsApp"
      aria-label="Send udhaar reminder on WhatsApp"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-green-600 transition-colors hover:bg-green-50 hover:text-green-700"
    >
      <MessageCircle className="h-4 w-4" />
    </button>
  )
}
