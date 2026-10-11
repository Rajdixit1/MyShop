import { Navigate, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import InstallPrompt from './components/InstallPrompt'
import WhatsAppButton from './components/WhatsAppButton'
import HomePage from './pages/HomePage'
import ProductListing from './pages/ProductListing'
import ProductDetail from './pages/ProductDetail'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderSuccess from './pages/OrderSuccess'
import TrackOrder from './pages/TrackOrder'
import LoginPage from './pages/LoginPage'
import MyOrders from './pages/MyOrders'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminProducts from './pages/admin/AdminProducts'
import AdminOrders from './pages/admin/AdminOrders'
import AdminCustomers from './pages/admin/AdminCustomers'
import { useAdmin } from './context/AdminContext'

function RequireAdmin({ children }) {
  const { admin, checking } = useAdmin()
  if (checking) return <div className="spinner" />
  if (!admin) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  const isAdminArea = window.location.pathname.startsWith('/admin')

  return (
    <>
      {!isAdminArea && <Header />}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductListing />} />
        <Route path="/category/:slug" element={<ProductListing />} />
        <Route path="/search" element={<ProductListing />} />
        <Route path="/product/:slug" element={<ProductDetail />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success/:orderNo" element={<OrderSuccess />} />
        <Route path="/track/:orderNo" element={<TrackOrder />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/orders" element={<MyOrders />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="store" element={<Navigate to="/" replace />} />
        </Route>

        <Route
          path="*"
          element={
            <div className="container">
              <div className="empty" style={{ marginTop: 12 }}>
                <div className="empty-emoji">🧭</div>
                <h3>Page not found</h3>
                <p>The page you are looking for does not exist.</p>
                <a href="/" className="btn-blue">GO TO HOME</a>
              </div>
            </div>
          }
        />
      </Routes>

      {!isAdminArea && <Footer />}
      {!isAdminArea && <InstallPrompt />}
      {!isAdminArea && <WhatsAppButton />}
    </>
  )
}