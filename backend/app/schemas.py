"""Pydantic request/response schemas."""

from typing import List, Optional

from pydantic import BaseModel, Field


class Category(BaseModel):
    id: int
    slug: str
    name: str
    icon: str
    tagline: Optional[str] = None
    product_count: int = 0


class Product(BaseModel):
    id: int
    slug: str
    name: str
    brand: str
    category: str
    category_name: str
    price: float
    mrp: float
    discount_percent: int
    savings: float
    unit: str
    rating: float
    rating_count: int
    reviews: int
    stock: int
    in_stock: bool
    emoji: str
    image_url: str = ""
    color: str
    description: str
    highlights: List[str]
    bestseller: bool
    deal: bool


class ProductPage(BaseModel):
    items: List[Product]
    total: int
    page: int
    page_size: int
    pages: int


class CartItemInput(BaseModel):
    slug: str
    qty: int = Field(ge=1, le=20)


class CartValidateRequest(BaseModel):
    items: List[CartItemInput]


class CartLine(BaseModel):
    product: Product
    qty: int
    line_total: float


class CartSummary(BaseModel):
    items: List[CartLine]
    item_count: int
    mrp_total: float
    subtotal: float
    total_savings: float
    delivery_fee: float
    handling_fee: float
    order_total: float
    free_delivery_threshold: float
    issues: List[str]


class OrderItem(BaseModel):
    slug: str
    name: str
    unit: str
    price: float
    qty: int


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=60)
    phone: str = Field(min_length=6, max_length=15)
    address: str = Field(min_length=5)
    payment_method: str = "COD"
    # exact drop point captured from the browser's geolocation / map pin
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0, le=100000)
    items: List[CartItemInput]


class Order(BaseModel):
    id: int
    order_no: str
    customer_name: str
    phone: str
    address: str
    payment_method: str
    items: List[OrderItem]
    subtotal: float
    delivery_fee: float
    total: float
    created_at: str
    status: str = "Order Confirmed"
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None


class AddressIn(BaseModel):
    label: str = Field(default="Home", max_length=30)
    address: str = Field(min_length=5, max_length=300)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    make_default: bool = False


class Address(BaseModel):
    id: int
    label: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = False
    created_at: str


# ---------------------------------------------------------------- auth
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    phone: str = Field(min_length=10, max_length=10)
    password: str = Field(min_length=4, max_length=72)
    address: str = ""


class LoginRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=10)
    password: str = Field(min_length=1, max_length=72)


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    address: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    created_at: str


class TokenResponse(BaseModel):
    token: str
    role: str
    user: Optional[UserOut] = None
    username: Optional[str] = None


# ---------------------------------------------------------------- admin
class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    image_url: Optional[str] = Field(default="", max_length=300)
    brand: str = Field(min_length=1, max_length=60)
    category: str
    price: float = Field(gt=0)
    mrp: Optional[float] = None
    unit: str = Field(min_length=1, max_length=20)
    stock: int = Field(ge=0, le=10000)
    rating: float = Field(default=4.0, ge=0, le=5)
    rating_count: int = Field(default=0, ge=0)
    emoji: str = "\U0001F35E"
    color: str = "#fef3c7"
    description: str = ""
    highlights: List[str] = []
    bestseller: bool = False
    deal: bool = False


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    image_url: Optional[str] = Field(default=None, max_length=300)
    brand: Optional[str] = Field(default=None, max_length=60)
    category: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    mrp: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = Field(default=None, max_length=20)
    stock: Optional[int] = Field(default=None, ge=0, le=10000)
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    emoji: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    highlights: Optional[List[str]] = None
    bestseller: Optional[bool] = None
    deal: Optional[bool] = None


class OrderStatusUpdate(BaseModel):
    status: str


class AdminStats(BaseModel):
    total_products: int
    total_orders: int
    total_users: int
    total_revenue: float
    low_stock_count: int
    out_of_stock_count: int
    orders_by_status: dict
    recent_orders: List[Order]
    top_products: List[dict]


# ------------------------------------------------------- tracking / whatsapp
class OrderEvent(BaseModel):
    id: int
    order_no: str
    status: str
    title: str
    note: str = ""
    source: str = "system"
    created_at: str


class TrackOrder(BaseModel):
    order: Order
    events: List[OrderEvent]
    eta: str
    whatsapp_url: str
    support_number: str


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    note: str = Field(default="", max_length=300)
    source: str = Field(default="admin", max_length=20)


class Suggestion(BaseModel):
    type: str          # product | category | brand
    label: str
    sublabel: str = ""
    slug: str = ""
    price: Optional[float] = None
    mrp: Optional[float] = None
    emoji: str = ""
    image_url: str = ""
    color: str = "#f1f3f6"
    in_stock: bool = True


class SuggestResponse(BaseModel):
    query: str
    suggestions: List[Suggestion]