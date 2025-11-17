// Redirect /org/stores to /org/shops (using shops internally but exposing stores in URL)
import { redirect } from 'next/navigation'

export default function StoresPage() {
  redirect('/org/shops')
}

