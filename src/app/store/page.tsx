// Redirect /store to /shop (using shop internally but exposing store in URL)
import { redirect } from 'next/navigation'

export default function StorePage() {
  redirect('/shop')
}

