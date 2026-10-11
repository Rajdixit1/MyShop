import { useEffect, useState } from 'react'

/**
 * Shows the "Install app" prompt so the PWA can be added to the home screen on
 * Android, iOS, macOS and Windows. Also registers the service worker.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [hidden, setHidden] = useState(
    () => sessionStorage.getItem('rashan-install-dismissed') === '1',
  )

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!deferred || hidden) return null

  const install = async () => {
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  const dismiss = () => {
    sessionStorage.setItem('rashan-install-dismissed', '1')
    setHidden(true)
  }

  return (
    <div className="install-banner">
      <span>📲 Install Devanand Saw Kirana Store as an app</span>
      <button onClick={install}>Install</button>
      <button className="x" onClick={dismiss} aria-label="Dismiss install prompt">×</button>
    </div>
  )
}