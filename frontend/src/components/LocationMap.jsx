import { useEffect, useRef, useState } from 'react'
import { FALLBACK } from './LocationPicker'

const TILE = 256

const project = (lat, lng, zoom) => {
  const scale = TILE * 2 ** zoom
  const siny = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * scale,
  }
}

/**
 * Read-only map that shows where an order will be delivered.
 *
 * Clicking it opens the pin in OpenStreetMap / Google Maps, which is handy for
 * the delivery agent working from the admin screen.
 */
export default function LocationMap({ lat, lng, zoom = 16, height = 220 }) {
  const ref = useRef(null)
  const [box, setBox] = useState({ w: 600, h: height })
  const hasPin = typeof lat === 'number' && typeof lng === 'number'

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const center = hasPin ? { lat, lng } : FALLBACK
  const z = hasPin ? zoom : 11

  const tiles = []
  if (box.w) {
    const c = project(center.lat, center.lng, z)
    const left = Math.round(c.x - box.w / 2)
    const top = Math.round(c.y - box.h / 2)
    const max = 2 ** z
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + box.h) / TILE); ty += 1) {
      if (ty < 0 || ty >= max) continue
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + box.w) / TILE); tx += 1) {
        const wrapped = ((tx % max) + max) % max
        tiles.push({
          key: `${z}/${tx}/${ty}`,
          url: `https://tile.openstreetmap.org/${z}/${wrapped}/${ty}.png`,
          left: Math.round(tx * TILE - left),
          top: Math.round(ty * TILE - top),
        })
      }
    }
  }

  const external = hasPin
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
    : ''

  return (
    <div className="field">
      <div className="geo-head">
        <label>Delivery location</label>
        {hasPin && (
          <a
            className="link-btn geo-locate"
            href={external}
            target="_blank"
            rel="noreferrer"
            data-testid="geo-open-map"
          >
            OPEN IN MAPS
          </a>
        )}
      </div>
      <div
        ref={ref}
        className="geo-map static"
        style={{ height }}
        data-testid="geo-static-map"
        aria-label="Delivery location map"
      >
        {tiles.map((t) => (
          <img key={t.key} src={t.url} alt="" draggable={false} style={{ left: t.left, top: t.top }} />
        ))}
        {hasPin && <div className="geo-pin" aria-hidden="true">📍</div>}
        {!hasPin && <div className="geo-empty">No map pin was saved for this order</div>}
        <div className="geo-attr">© OpenStreetMap</div>
      </div>
      {hasPin && (
        <div className="geo-status">
          <span data-testid="geo-coords">
            Pinned {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  )
}