import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const SLIDES = [
  {
    title: 'Monthly Grocery Sale',
    text: 'Up to 40% off on Atta, Rice, Daal and more',
    emoji: '🛍️',
    bg: 'linear-gradient(120deg, #2874f0, #1a5dc8)',
    to: '/products?sort=discount',
    cta: 'Shop Now',
  },
  {
    title: 'Fresh Staples Daily',
    text: 'Basmati Rice, Toor Daal & Chakki Atta at best prices',
    emoji: '🌾',
    bg: 'linear-gradient(120deg, #f0932b, #e2711d)',
    to: '/category/atta-rice-daal',
    cta: 'Buy Staples',
  },
  {
    title: 'Pure Ghee & Cold Pressed Oil',
    text: 'Amul Ghee and Kachi Ghani oils with free delivery',
    emoji: '🫙',
    bg: 'linear-gradient(120deg, #11998e, #38ef7d)',
    to: '/category/oil-ghee',
    cta: 'Explore',
  },
  {
    title: 'Chai Time Snacks',
    text: 'Biscuits, Namkeen and Chai - buy 2 get 1 free',
    emoji: '🍪',
    bg: 'linear-gradient(120deg, #8e2de2, #e94057)',
    to: '/category/biscuits-snacks',
    cta: 'Order Snacks',
  },
]

export default function BannerCarousel() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000)
    return () => clearInterval(id)
  }, [])

  const slide = SLIDES[index]
  const prev = () => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)
  const next = () => setIndex((i) => (i + 1) % SLIDES.length)

  return (
    <div className="container banner">
      <div className="banner-slide" style={{ background: slide.bg }}>
        <div>
          <h2>{slide.title}</h2>
          <p>{slide.text}</p>
          <Link to={slide.to} className="banner-cta">{slide.cta} →</Link>
        </div>
        <div className="banner-emoji" role="img" aria-label={slide.title}>{slide.emoji}</div>
      </div>

      <button className="banner-arrow left" onClick={prev} aria-label="Previous banner">‹</button>
      <button className="banner-arrow right" onClick={next} aria-label="Next banner">›</button>

      <div className="banner-dots">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            className={`banner-dot ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}