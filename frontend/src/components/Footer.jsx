import { Link } from 'react-router-dom'

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { label: 'Atta, Rice & Daal', to: '/category/atta-rice-daal' },
      { label: 'Oil & Ghee', to: '/category/oil-ghee' },
      { label: 'Masala & Spices', to: '/category/masala' },
      { label: 'Dry Fruits & Nuts', to: '/category/dry-fruits' },
      { label: 'Drinks & Beverages', to: '/category/beverages' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Track Order', to: '/orders' },
      { label: 'Delivery Charges', to: '/' },
      { label: 'Return Policy', to: '/' },
      { label: 'Contact Us', to: '/' },
      { label: 'FAQs', to: '/' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', to: '/' },
      { label: 'Careers', to: '/' },
      { label: 'Privacy Policy', to: '/' },
      { label: 'Terms & Conditions', to: '/' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-cols">
          <div>
            <div className="logo" style={{ marginBottom: 12 }}>
              <span className="logo-mark">🛒</span> Devenand Saw Kirana Store
            </div>
            <p style={{ color: '#6d7f93', fontSize: 12, lineHeight: 1.7, maxWidth: 260 }}>
              Your neighbourhood kirana store, now online. Fresh groceries delivered to your
              door in 24 hours - chawal, daal, atta, ghee and every daily essential.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h5>{col.title}</h5>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h5>Stay Updated</h5>
            <p style={{ color: '#6d7f93', fontSize: 12, lineHeight: 1.7 }}>
              Get offers on your favourite staples every week.
            </p>
            <button className="btn-blue" style={{ padding: '10px 20px' }}>
              Subscribe
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} Devenand Saw Kirana Store - Demo grocery store built with FastAPI + React.
        </div>
      </div>
    </footer>
  )
}