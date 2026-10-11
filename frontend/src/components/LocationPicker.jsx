import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// A tiny slippy map built on plain OpenStreetMap raster tiles - no map library and
// no API key. Tile maths follows the standard Web Mercator scheme.
const TILE = 256
const MIN_ZOOM = 3
const MAX_ZOOM = 19
// Fallback centre (Delhi) so the map is never blank before a pin is chosen.
export const FALLBACK = { lat: 28.6139, lng: 77.209 }

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** lat/lng -> world pixel coordinates at a given zoom. */
function project(lat, lng, zoom) {
  const scale = TILE * 2 ** zoom
  const siny = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * scale,
  }
}

/** world pixel coordinates -> lat/lng. */
function unproject(x, y, zoom) {
  const scale = TILE * 2 ** zoom
  const lng = (x / scale) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / scale
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng }
}

const tileUrl = (x, y, zoom) => `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`

/**
 * Interactive map used to drop an exact delivery pin.
 *
 * Drag to pan, wheel or buttons to zoom, and the pin stays centred - the same
 * behaviour Google Maps uses when you drop a marker on a location.
 */
export default function LocationPicker({ value, onChange, height = 260, label = 'Delivery location' }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: height })
  const [center, setCenter] = useState(
    value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : FALLBACK,
  )
  const [zoom, setZoom] = useState(value?.lat != null ? 17 : 12)
  const [dragging, setDragging] = useState(false)
  const [accuracy, setAccuracy] = useState(value?.accuracy ?? null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')

  // Follow a pin that was set from the outside, e.g. picking a saved address.
  useEffect(() => {
    if (value?.lat == null || value?.lng == null) return
    setCenter((c) =>
      Math.abs(c.lat - value.lat) < 1e-6 && Math.abs(c.lng - value.lng) < 1e-6
        ? c
        : { lat: value.lat, lng: value.lng },
    )
  }, [value?.lat, value?.lng])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tiles = useMemo(() => {
    const c = project(center.lat, center.lng, zoom)
    const left = Math.round(c.x - size.w / 2)
    const top = Math.round(c.y - size.h / 2)
    const firstX = Math.floor(left / TILE)
    const firstY = Math.floor(top / TILE)
    const cols = Math.ceil(size.w / TILE) + 2
    const rows = Math.ceil(size.h / TILE) + 2
    const max = 2 ** zoom
    const list = []
    for (let dy = 0; dy < rows; dy += 1) {
      for (let dx = 0; dx < cols; dx += 1) {
        const tx = firstX + dx
        const ty = firstY + dy
        if (ty < 0 || ty >= max) continue
        // wrap the x index so panning past the antimeridian still shows tiles
        const wrapped = ((tx % max) + max) % max
        list.push({
          key: `${zoom}/${tx}/${ty}`,
          url: tileUrl(wrapped, ty, zoom),
          left: Math.round(tx * TILE - left),
          top: Math.round(ty * TILE - top),
        })
      }
    }
    return list
  }, [center, zoom, size])

  const emit = useCallback(
    (lat, lng, acc) => {
      const next = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracy: acc == null ? null : Math.round(acc),
      }
      setAccuracy(next.accuracy)
      onChange(next)
    },
    [onChange],
  )

  /** Converts a pointer position inside the map into lat/lng. */
  const toLatLng = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    const c = project(center.lat, center.lng, zoom)
    const px = c.x - size.w / 2 + (clientX - rect.left)
    const py = c.y - size.h / 2 + (clientY - rect.top)
    return unproject(px, py, zoom)
  }

  const onPointerDown = (e) => {
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragging) return
    const next = toLatLng(e.clientX, e.clientY)
    setCenter({ lat: clamp(next.lat, -85, 85), lng: clamp(next.lng, -180, 180) })
  }

  const onPointerUp = (e) => {
    if (!dragging) return
    setDragging(false)
    // The pin lands exactly where the shopper let go of the map.
    const { lat, lng } = toLatLng(e.clientX, e.clientY)
    setCenter({ lat, lng })
    emit(lat, lng, null)
  }

  const onWheel = (e) => {
    setZoom((z) => clamp(z + (e.deltaY < 0 ? 1 : -1), MIN_ZOOM, MAX_ZOOM))
  }

  /** Uses the device GPS for the exact spot - the most accurate option. */
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('This browser cannot detect your location')
      return
    }
    setLocating(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords
        setCenter({ lat: latitude, lng: longitude })
        setZoom(18)
        emit(latitude, longitude, acc)
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setGeoError(
          err.code === 1
            ? 'Location permission denied - drop the pin manually instead'
            : 'Could not detect your location - drop the pin manually instead',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  return (
    <div className="field">
      <div className="geo-head">
        <label>{label}</label>
        <button
          type="button"
          className="link-btn geo-locate"
          onClick={useMyLocation}
          disabled={locating}
          data-testid="geo-locate-btn"
        >
          {locating ? 'LOCATING...' : 'USE MY EXACT LOCATION'}
        </button>
      </div>

      <div
        ref={containerRef}
        className={`geo-map ${dragging ? 'dragging' : ''}`}
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="application"
        aria-label="Map - drag to move and drop your delivery pin"
        data-testid="geo-map"
      >
        {tiles.map((t) => (
          <img key={t.key} src={t.url} alt="" draggable={false} style={{ left: t.left, top: t.top }} />
        ))}

        <div className="geo-zoom">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => clamp(z + 1, MIN_ZOOM, MAX_ZOOM))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => clamp(z - 1, MIN_ZOOM, MAX_ZOOM))}
          >
            −
          </button>
        </div>

        {value?.lat != null && <div className="geo-pin" aria-hidden="true">📍</div>}

        <div className="geo-attr">© OpenStreetMap</div>
      </div>

      <div className="geo-status">
        {geoError && <span className="err">{geoError}</span>}
        {value?.lat != null ? (
          <span data-testid="geo-coords">
            Pinned {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            {value.accuracy != null && <span className="geo-accuracy"> (±{value.accuracy}m)</span>}
          </span>
        ) : (
          <span className="geo-hint">Drag the map and release to drop your exact pin</span>
        )}
      </div>
    </div>
  )
}