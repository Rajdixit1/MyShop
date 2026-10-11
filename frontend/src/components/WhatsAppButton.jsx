import { useEffect, useState } from 'react'
import { api } from '../api'

/**
 * Floating WhatsApp button that opens a chat with the store's support desk.
 * The number and message come from the API so it can be changed without a rebuild.
 */
export default function WhatsAppButton() {
  const [url, setUrl] = useState('')

  useEffect(() => {
    api
      .supportWhatsapp()
      .then((res) => setUrl(res.url))
      .catch(() => setUrl(''))
  }, [])

  if (!url) return null

  return (
    <a
      className="wa-float"
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Chat with us on WhatsApp"
      aria-label="Chat with us on WhatsApp"
      data-testid="whatsapp-float"
    >
      💬
    </a>
  )
}