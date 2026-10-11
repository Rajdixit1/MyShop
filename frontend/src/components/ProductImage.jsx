import { useState } from 'react'

/**
 * Shows a product photo when one was uploaded, otherwise falls back to the
 * emoji placeholder on the product's colour. A broken image URL also degrades
 * to the emoji rather than leaving an empty box.
 */
export default function ProductImage({ imageUrl, emoji, alt, className, style }) {
  const [failed, setFailed] = useState(false)
  const showPhoto = imageUrl && !failed

  if (!showPhoto) {
    return (
      <span className={className} style={style} role="img" aria-label={alt}>
        {emoji}
      </span>
    )
  }

  return (
    <img
      className={className}
      src={imageUrl}
      alt={alt}
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}