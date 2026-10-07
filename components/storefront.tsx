"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Home,
  Store,
  Grid2X2,
  Utensils,
  Tag,
  Package,
  UserRound,
  ShoppingCart,
  Search,
  MapPin,
  ArrowRight,
  Footprints,
  Beef,
  Shirt,
  Carrot,
  Pencil,
  Cookie,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { db, configured } from "@/lib/supabase";
import * as demo from "@/lib/demo";
import {
  money,
  checkoutSchema,
  type Category,
  type Shop,
  type Deal,
  type Profile,
  type Order,
} from "@/lib/models";
import Admin from "./admin";
import BusinessRegistration from "./business-registration";
const icons = [
  Footprints,
  Beef,
  Shirt,
  Store,
  Carrot,
  Pencil,
  Cookie,
  Utensils,
];
const locations: Record<string, string[]> = {
  "Andhra Pradesh": ["Narsapur", "Vijayawada", "Visakhapatnam"],
  Telangana: ["Hyderabad", "Warangal"],
  Karnataka: ["Bengaluru", "Mysuru"],
};
const nav = [
  ["/", "Home", Home],
  ["/shops", "All Shops", Store],
  ["/categories", "Categories", Grid2X2],
  ["/restaurants", "Restaurants", Utensils],
  ["/deals", "Deals & Offers", Tag],
  ["/customer", "Customer Hub", UserRound],
  ["/orders", "Orders", Package],
  ["/account", "My Account", UserRound],
] as const;
export default function Storefront() {
  const path = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [categories, setCategories] = useState<Category[]>(
      configured ? [] : demo.categories,
    ),
    [shops, setShops] = useState<Shop[]>(configured ? [] : demo.shops),
    [deals, setDeals] = useState<Deal[]>(configured ? [] : demo.deals);
  const [loading, setLoading] = useState(configured),
    [message, setMessage] = useState(""),
    [profile, setProfile] = useState<Profile | null>(null),
    [email, setEmail] = useState(""),
    [orders, setOrders] = useState<Order[]>([]),
    [cart, setCart] = useState<Record<string, number>>({}),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [mode, setMode] = useState("signin"),
    [signupAccountType, setSignupAccountType] = useState<"customer" | "merchant">("customer"),
    [state, setState] = useState("Andhra Pradesh"),
    [city, setCity] = useState("Narsapur"),
    [query, setQuery] = useState(params.get("q") || "");
  const [requestId, setRequestId] = useState("");
  async function load() {
    if (!db) return;
    setLoading(true);
    const results = await Promise.all([
      db.from("categories").select("*").order("name"),
      db.from("shops").select("*").order("name"),
      db.from("deals").select("*").order("title"),
    ]);
    if (results.some((r) => r.error))
      setMessage(
        "Unable to load listings. Please check your connection and try again.",
      );
    else {
      setCategories(results[0].data || []);
      setShops(results[1].data || []);
      setDeals(results[2].data || []);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    try {
      const saved = JSON.parse(localStorage.getItem("dd-cart") || "{}");
      setCart(
        Object.fromEntries(
          Object.entries(saved).filter(
            ([k, v]) =>
              /^[0-9a-f-]{36}$/.test(k) &&
              Number.isInteger(v) &&
              Number(v) > 0 &&
              Number(v) <= 20,
          ),
        ) as Record<string, number>,
      );
      const loc = JSON.parse(localStorage.getItem("dd-location") || "null");
      if (loc && locations[loc.state]?.includes(loc.city)) {
        setState(loc.state);
        setCity(loc.city);
      }
    } catch {}
    setReady(true);
    let savedRequest: string | null = null;
    try { savedRequest = localStorage.getItem("dd-request"); } catch {}
    setRequestId(
      savedRequest && /^[0-9a-f-]{36}$/.test(savedRequest)
        ? savedRequest
        : crypto.randomUUID(),
    );
    if (!db) return;
    const client = db;
    const sync = async () => {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        const { data } = await client
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      } else {
        setProfile(null);
        setEmail("");
      }
    };
    sync();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      setTimeout(sync, 0);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem("dd-cart", JSON.stringify(cart));
        if (requestId) localStorage.setItem("dd-request", requestId);
      } catch {}
    }
  }, [cart, ready, requestId]);
  useEffect(() => {
    if (ready)
      localStorage.setItem("dd-location", JSON.stringify({ state, city }));
  }, [state, city, ready]);
  useEffect(() => {
    setOpen(false);
    setMessage("");
    setOrders([]);
    if ((path === "/orders" || path === "/customer") && profile && db)
      db.from("orders")
        .select("*,order_items(*)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) setMessage(error.message);
          else setOrders(data || []);
        });
  }, [path, profile]);
  useEffect(() => { load(); }, [profile?.id, profile?.role]);
  const dashboardPath = profile?.role === "admin" ? "/admin" : (profile?.role === "merchant" || profile?.account_type === "merchant") ? "/merchant" : "/customer";
  useEffect(() => {
    if (profile?.active && path === "/account" && !params.get("recovery")) router.replace(dashboardPath);
  }, [profile?.id, profile?.role, profile?.account_type]);
  const localShops = shops.filter(
    (s) => s.active && s.state === state && s.city === city,
  );
  const category = params.get("category");
  const q = (params.get("q") || "").toLowerCase();
  const filteredShops = localShops.filter(
    (s) =>
      (!category || s.category_id === category) &&
      (!q ||
        `${s.name} ${s.description} ${categories.find((c) => c.id === s.category_id)?.name}`
          .toLowerCase()
          .includes(q)),
  );
  const available = deals.filter(
    (d) =>
      d.active &&
      d.stock > 0 &&
      new Date(d.expires_at) > new Date() &&
      localShops.some((s) => s.id === d.shop_id),
  );
  const filteredDeals = available.filter(
    (d) =>
      (!category ||
        shops.find((s) => s.id === d.shop_id)?.category_id === category) &&
      (!q ||
        `${d.title} ${d.description} ${shops.find((s) => s.id === d.shop_id)?.name}`
          .toLowerCase()
          .includes(q)),
  );
  const lines = Object.entries(cart).map(([id, quantity]) => ({
    deal: deals.find((d) => d.id === id),
    id,
    quantity,
  }));
  const total = lines.reduce(
    (sum, l) => sum + (l.deal?.price || 0) * l.quantity,
    0,
  );
  function changeCart(id: string, quantity: number) {
    setCart((c) => {
      const next = { ...c };
      if (quantity <= 0) delete next[id];
      else next[id] = Math.min(20, quantity);
      return next;
    });
    setRequestId(crypto.randomUUID());
  }
  function add(d: Deal) {
    changeCart(d.id, Math.min(d.stock, (cart[d.id] || 0) + 1));
    setMessage(`${d.title} added to your cart.`);
  }
  function search(e: FormEvent) {
    e.preventDefault();
    router.push(`/deals?q=${encodeURIComponent(query)}`);
  }
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db) {
      setMessage(
        "Demo browsing is enabled. Connect Supabase to create an account or sign in.",
      );
      return;
    }
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")),
      password = String(f.get("password"));
    let error;
    if (mode === "signup") {
      ({ error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: { name: f.get("name"), account_type: signupAccountType },
          emailRedirectTo: window.location.origin + "/account",
        },
      }));
    } else if (mode === "reset") {
      ({ error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/account?recovery=1",
      }));
    } else {
      ({ error } = await db.auth.signInWithPassword({ email, password }));
    }
    setMessage(
      error
        ? error.message
        : mode === "signup"
          ? signupAccountType === "merchant" ? "Confirm your email, then sign in to register your business. Merchant access begins after administrator approval." : "Check your email to confirm your account."
          : mode === "reset"
            ? "If an account exists, a reset email is on its way."
            : "You are signed in.",
    );
    setBusy(false);
  }
  async function logout() {
    if (!db || busy) return;
    setBusy(true);
    try {
      const { error } = await db.auth.signOut();
      if (error) {
        setMessage(error.message);
        return;
      }
      setProfile(null);
      setEmail("");
      setOrders([]);
      setMode("signin");
      router.replace("/account");
    } catch {
      setMessage("Unable to log out. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function checkout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db || !profile) {
      setMessage(
        "Sign in to place your order. Demo mode does not create real orders.",
      );
      return;
    }
    const f = new FormData(e.currentTarget);
    const parsed = checkoutSchema.safeParse({
      address: f.get("address"),
      items: lines.map((l) => ({ deal_id: l.id, quantity: l.quantity })),
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await db.rpc("place_order", {
      ...parsed.data,
      request_id: requestId,
    });
    if (error) setMessage(error.message);
    else {
      setCart({});
      setRequestId(crypto.randomUUID());
      await load();
      router.push("/orders");
    }
    setBusy(false);
  }
  function section(title: string, href: string, label: string) {
    return (
      <div className="section-heading">
        <h2>{title}</h2>
        <Link href={href}>
          {label}
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }
  function picture(s: Shop | Deal, className = "") {
    const i = shops.findIndex(
      (x) => x.id === ("shop_id" in s ? s.shop_id : s.id),
    );
    return (
      <div className={`product-art art-${Math.max(0, i) % 5} ${className}`}>
        {s.image.startsWith("https://") ? (
          <img src={s.image} alt={"title" in s ? s.title : s.name} />
        ) : (
          <span aria-hidden="true">
            {["👟", "🥩", "👕", "🥬", "🍛"][Math.max(0, i) % 5]}
          </span>
        )}
      </div>
    );
  }
  function shopCard(s: Shop) {
    return (
      <Link className="shop-card" href={`/shops/${s.id}`} key={s.id}>
        {picture(s)}
        <div className="card-body">
          <h3>{s.name}</h3>
          <p>{categories.find((c) => c.id === s.category_id)?.name}</p>
          <p>{(() => { const offers = available.filter(d => d.shop_id === s.id); return offers.length ? `${offers.length} offers · Up to ${Math.max(...offers.map(d => Math.round((1-d.price/d.original_price)*100)))}% off` : "No current discounts"; })()}</p>
          <div className="card-bottom">
            <span>
              <MapPin size={13} />
              {s.city}
            </span>
            <b>
              View shop <ArrowRight size={13} />
            </b>
          </div>
        </div>
      </Link>
    );
  }
  function dealCard(d: Deal) {
    return (
      <article className="deal-card" key={d.id}>
        <Link aria-label={`View ${d.title}`} href={`/deals/${d.id}`}>
          {picture(d)}
        </Link>
        <div>
          <span className="badge">
            {Math.round((1 - d.price / d.original_price) * 100)}% OFF
          </span>
          <Link href={`/deals/${d.id}`}>
            <h3>{d.title}</h3>
          </Link>
          <p>{shops.find((s) => s.id === d.shop_id)?.name}</p>
          <div className="price">
            {money(d.price)} <del>{money(d.original_price)}</del>
          </div>
          <button className="small" onClick={() => add(d)}>
            Add to cart <Plus size={14} />
          </button>
        </div>
      </article>
    );
  }
  const isHome = path === "/";
  const selectedShop = shops.find((s) => path === `/shops/${s.id}`);
  const selectedDeal = deals.find((d) => path === `/deals/${d.id}`);
  return (
    <>
      <header>
        <Link href="/" className="brand">
          <span>
            D<small>&</small>
            <b>D</b>
          </span>
          <strong>ODAD Mart</strong>
        </Link>
        <form className="search" onSubmit={search}>
          <Search size={20} />
          <input
            aria-label="Search products shops or categories"
            placeholder="Search for products, shops or categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <div className="location">
          <MapPin size={21} />
          <select
            aria-label="State"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setCity(locations[e.target.value][0]);
            }}
          >
            {Object.keys(locations).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {locations[state].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <Link href="/cart" className="cart-icon" aria-label="Cart">
          <ShoppingCart />
          <sup>{Object.values(cart).reduce((a, b) => a + b, 0)}</sup>
        </Link>
        <Link href="/account" aria-label="Account">
          <UserRound />
        </Link>
        <button
          className="mobile-toggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={open ? "open" : ""}>
        <nav>
          {nav.filter(([href]) => href !== "/customer" || !profile || profile.role === "customer").map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
            >
              <Icon size={22} />
              {label}
            </Link>
          ))}
          {(profile?.role === "merchant" || profile?.account_type === "merchant") && <Link href="/merchant" className={path === "/merchant" ? "active" : ""}><Store size={22} />Merchant Studio</Link>}
          {profile?.role === "admin" && (
            <Link href="/admin" className={path === "/admin" ? "active" : ""}>
              <ShieldCheck size={22} />
              Admin Console
            </Link>
          )}
        </nav>
        <div className="sidebar-note">
          <Tag size={30} />
          <h3>
            Small shops.
            <br />
            Big savings.
          </h3>
          <p>Discover something good around your corner.</p>
          <Link href="/deals">
            Explore local offers <ArrowRight size={15} />
          </Link>
        </div>
      </aside>
      <main>
        {!configured && (
          <div className="demo-note">
            Demo catalogue · Connect Supabase to enable accounts, orders and
            admin management.
          </div>
        )}
        {message && (
          <div role="status" className="notice">
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              <X size={17} />
            </button>
          </div>
        )}
        {loading ? (
          <div className="empty">Loading your local finds…</div>
        ) : (
          <>
            {isHome && (
              <>
                <div className="hero-grid">
                  <section className="hero">
                    <div>
                      <span className="eyebrow">
                        YOUR NEIGHBOURHOOD. BETTER VALUE.
                      </span>
                      <h1>
                        Great finds.
                        <br />
                        <em>Even better prices.</em>
                      </h1>
                      <p>
                        Discover everyday deals from the shops
                        <br className="desktop" /> you love, right here in{" "}
                        {city}.
                      </p>
                      <Link className="button" href="/deals">
                        Explore deals <ArrowRight size={17} />
                      </Link>
                      <div className="hero-meta">
                        LOCAL SHOPS <span>•</span> EVERYDAY SAVINGS
                      </div>
                    </div>
                    <div className="hero-value">
                      <Tag size={54} />
                      <span>MORE LOCAL.</span>
                      <strong>
                        MORE
                        <br />
                        FOR LESS.
                      </strong>
                      <small>Discover your next favourite.</small>
                    </div>
                  </section>
                  <section className="special">
                    <Tag size={42} />
                    <span className="eyebrow">A LITTLE TREAT FOR YOU</span>
                    <h2>
                      Your next great
                      <br />
                      deal is nearby.
                    </h2>
                    <p>
                      Fresh picks. Favourite places.
                      <br />
                      Prices worth stepping out for.
                    </p>
                    <Link href="/deals">
                      See all offers <ArrowRight size={16} />
                    </Link>
                  </section>
                </div>
                {section("Shop by Category", "/categories", "View all")}
                <div className="category-grid">
                  {categories.map((c, i) => {
                    const Icon = icons[i % icons.length];
                    return (
                      <Link href={`/shops?category=${c.id}`} key={c.id}>
                        <Icon size={31} />
                        <span>{c.name}</span>
                      </Link>
                    );
                  })}
                </div>
                {section(
                  `Featured Shops in ${city}`,
                  "/shops",
                  "View all shops",
                )}
                <div className="shop-grid">
                  {localShops
                    .filter((s) => s.featured)
                    .slice(0, 5)
                    .map(shopCard)}
                </div>
                {!localShops.length && (
                  <p className="empty">
                    We’re growing. There are no shops in {city} yet. Try
                    Narsapur.
                  </p>
                )}
                {section("Deals of the Day", "/deals", "View all deals")}
                <div className="deal-grid">
                  {available.filter((d) => d.featured).map(dealCard)}
                </div>
              </>
            )}
            {(path === "/shops" || path === "/restaurants") && (
              <>
                <div className="page-heading">
                  <span className="eyebrow">DISCOVER YOUR NEIGHBOURHOOD</span>
                  <h1>
                    {path === "/restaurants" ? "Restaurants" : categories.find(c => c.id === category)?.name ? `${categories.find(c => c.id === category)?.name} shops` : "All shops"} in{" "}
                    {city}
                  </h1>
                  <p>Good things are closer than you think.</p>
                </div>
                <div className="shop-grid">
                  {filteredShops
                    .filter((s) => path !== "/restaurants" || s.restaurant)
                    .map(shopCard)}
                </div>
                {!filteredShops.filter(
                  (s) => path !== "/restaurants" || s.restaurant,
                ).length && (
                  <p className="empty">
                    No shops found. Try another city or category.
                  </p>
                )}
              </>
            )}
            {path === "/categories" && (
              <>
                <h1>Shop by category</h1>
                <div className="category-grid large">
                  {categories.map((c, i) => {
                    const Icon = icons[i % 8];
                    return (
                      <Link href={`/shops?category=${c.id}`} key={c.id}>
                        <Icon size={36} />
                        {c.name}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
            {path === "/deals" && (
              <>
                <div className="page-heading">
                  <h1>
                    {q ? `Results for “${params.get("q")}”` : "Deals & offers"}
                  </h1>
                  <p>Discover more. Spend less. Shop local.</p>
                </div>
                <div className="filters">
                  <Link className={!category ? "selected" : ""} href="/deals">
                    All offers
                  </Link>
                  {categories.map((c) => (
                    <Link
                      className={category === c.id ? "selected" : ""}
                      href={`/deals?category=${c.id}`}
                      key={c.id}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
                <div className="deal-grid">{filteredDeals.map(dealCard)}</div>
                {!filteredDeals.length && (
                  <p className="empty">
                    No offers found. Try another search, category or city.
                  </p>
                )}
                {q && filteredShops.length > 0 && (
                  <>
                    {section("Matching shops", "/shops", "All shops")}
                    <div className="shop-grid">
                      {filteredShops.map(shopCard)}
                    </div>
                  </>
                )}
              </>
            )}
            {selectedShop && (
              <>
                <Link className="back" href="/shops">
                  ← All shops
                </Link>
                <section className="detail">
                  {picture(selectedShop)}
                  <div>
                    <span className="badge">
                      {selectedShop.restaurant
                        ? "Restaurant"
                        : "Neighbourhood favourite"}
                    </span>
                    <h1>{selectedShop.name}</h1>
                    <p>{selectedShop.description}</p>
                    <p>
                      <MapPin size={16} /> {selectedShop.address},{" "}
                      {selectedShop.state}
                    </p>
                    <span className="muted">
                      Pay on collection • Collect directly from the shop
                    </span>
                  </div>
                </section>
                <h2>Available offers</h2>
                <div className="deal-grid">
                  {deals
                    .filter(
                      (d) =>
                        d.shop_id === selectedShop.id &&
                        d.active &&
                        d.stock > 0 &&
                        new Date(d.expires_at) > new Date(),
                    )
                    .map(dealCard)}
                </div>
              </>
            )}
            {selectedDeal && (
              <>
                <Link className="back" href="/deals">
                  ← All offers
                </Link>
                <section className="detail">
                  {picture(selectedDeal)}
                  <div>
                    <span className="badge">
                      {Math.round(
                        (1 - selectedDeal.price / selectedDeal.original_price) *
                          100,
                      )}
                      % OFF
                    </span>
                    <h1>{selectedDeal.title}</h1>
                    <Link
                      className="orange"
                      href={`/shops/${selectedDeal.shop_id}`}
                    >
                      {shops.find((s) => s.id === selectedDeal.shop_id)?.name}
                    </Link>
                    <p>{selectedDeal.description}</p>
                    <div className="price big">
                      {money(selectedDeal.price)}{" "}
                      <del>{money(selectedDeal.original_price)}</del>
                    </div>
                    <p>
                      {selectedDeal.stock} available · Valid until{" "}
                      {new Date(selectedDeal.expires_at).toLocaleDateString(
                        "en-IN",
                      )}
                    </p>
                    <button
                      disabled={
                        !selectedDeal.active ||
                        selectedDeal.stock === 0 ||
                        new Date(selectedDeal.expires_at) <= new Date()
                      }
                      onClick={() => add(selectedDeal)}
                    >
                      Add to cart <ShoppingCart size={18} />
                    </button>
                  </div>
                </section>
              </>
            )}
            {path === "/cart" && (
              <>
                <h1>Your cart</h1>
                {!lines.length ? (
                  <div className="empty">
                    <ShoppingCart size={36} />
                    <h2>Your next great find is waiting.</h2>
                    <Link className="button" href="/deals">
                      Explore deals
                    </Link>
                  </div>
                ) : (
                  <div className="checkout-grid">
                    <section className="panel">
                      {lines.map((l) => (
                        <div className="cart-line" key={l.id}>
                          <div>
                            <h3>{l.deal?.title || "Unavailable item"}</h3>
                            <p>{money(l.deal?.price || 0)} each</p>
                          </div>
                          <div className="quantity">
                            <button
                              aria-label="Decrease quantity"
                              onClick={() => changeCart(l.id, l.quantity - 1)}
                            >
                              <Minus size={14} />
                            </button>
                            {l.quantity}
                            <button
                              aria-label="Increase quantity"
                              disabled={
                                l.quantity >= Math.min(20, l.deal?.stock || 0)
                              }
                              onClick={() => changeCart(l.id, l.quantity + 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            className="plain"
                            aria-label="Remove item"
                            onClick={() => changeCart(l.id, 0)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ))}
                    </section>
                    <form className="panel form" onSubmit={checkout}>
                      <h2>Order summary</h2>
                      <div className="total">
                        <span>Total</span>
                        <strong>{money(total)}</strong>
                      </div>
                      <p>
                        Pay on collection at each shop. No delivery fee. Your
                        order confirms availability with the shop.
                      </p>
                      <label>
                        Contact name, phone and collection notes
                        <textarea
                          name="address"
                          required
                          minLength={10}
                          maxLength={500}
                          placeholder="Name, phone number and preferred collection time"
                        />
                      </label>
                      {!profile && (
                        <Link className="orange" href="/account">
                          Sign in to order →
                        </Link>
                      )}
                      <button
                        disabled={
                          busy || !profile || lines.some((l) => !l.deal)
                        }
                      >
                        {busy
                          ? "Placing order…"
                          : "Place order · Pay on collection"}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
            {path === "/orders" && (
              <>
                <h1>Your orders</h1>
                {!profile ? (
                  <div className="empty">
                    Sign in to see your orders.{" "}
                    <Link href="/account">Sign in →</Link>
                  </div>
                ) : orders.length ? (
                  orders.map((o) => (
                    <article className="panel order" key={o.id}>
                      <div className="section-heading">
                        <h3>Order #{o.id.slice(0, 8)}</h3>
                        <span className="badge">{o.status}</span>
                      </div>
                      <p>{new Date(o.created_at).toLocaleString("en-IN")}</p>
                      {o.order_items.map((i, n) => (
                        <div className="total" key={n}>
                          <span>
                            {i.title} × {i.quantity}
                          </span>
                          <span>{money(i.unit_price * i.quantity)}</span>
                        </div>
                      ))}
                      <div className="total">
                        <strong>Total · Pay on collection</strong>
                        <strong>{money(o.total)}</strong>
                      </div>
                      <p>{o.address}</p>
                    </article>
                  ))
                ) : (
                  <div className="empty">
                    No orders yet.{" "}
                    <Link href="/deals">Find your first deal →</Link>
                  </div>
                )}
              </>
            )}
            {path === "/account" && (
              <div className="account panel">
                <span className="eyebrow">YOUR LOCAL SAVINGS START HERE</span>
                <h1>
                  {profile
                    ? "My account"
                    : mode === "signup"
                      ? "Create an account"
                      : mode === "reset"
                        ? "Reset password"
                        : "Welcome back"}
                </h1>
                {profile ? (
                  <>
                    <p>{email}</p>
                    <form
                      className="form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!db) return;
                        const f = new FormData(e.currentTarget);
                        const { error } = await db
                          .from("profiles")
                          .update({
                            name: f.get("name"),
                            phone: f.get("phone"),
                          })
                          .eq("id", profile.id);
                        setMessage(error ? error.message : "Profile saved.");
                      }}
                    >
                      <label>
                        Name
                        <input
                          name="name"
                          defaultValue={profile.name}
                          required
                          maxLength={120}
                        />
                      </label>
                      <label>
                        Phone
                        <input
                          name="phone"
                          defaultValue={profile.phone}
                          maxLength={30}
                        />
                      </label>
                      <button>Save profile</button>
                    </form>
                    {params.get("recovery") && (
                      <form
                        className="form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const { error } = await db!.auth.updateUser({
                            password: String(
                              new FormData(e.currentTarget).get("password"),
                            ),
                          });
                          setMessage(
                            error ? error.message : "Password updated.",
                          );
                          if (!error) router.replace("/account");
                        }}
                      >
                        <label>
                          New password
                          <input
                            name="password"
                            type="password"
                            minLength={12}
                            required
                            autoComplete="new-password"
                          />
                        </label>
                        <button>Update password</button>
                      </form>
                    )}
                    <BusinessRegistration categories={categories} />
                    <button
                      className="secondary"
                      onClick={async () => {
                        await db?.auth.signOut();
                        setProfile(null);
                        setOrders([]);
                      }}
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <form className="form" onSubmit={auth}>
                      {mode === "signup" && <fieldset><legend>I’m creating an account as a</legend>
                        <label className="check"><input type="radio" name="account_type" value="customer" checked={signupAccountType === "customer"} onChange={() => setSignupAccountType("customer")} />Customer · browse and shop</label>
                        <label className="check"><input type="radio" name="account_type" value="merchant" checked={signupAccountType === "merchant"} onChange={() => setSignupAccountType("merchant")} />Merchant · register my business</label>
                        {signupAccountType === "merchant" && <p>Your email must be confirmed and your business approved before you can publish offers.</p>}
                      </fieldset>}
                      {mode === "signup" && (
                        <label>
                          Your name
                          <input
                            name="name"
                            required
                            maxLength={120}
                            autoComplete="name"
                          />
                        </label>
                      )}
                      <label>
                        Email address
                        <input
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                        />
                      </label>
                      {mode !== "reset" && (
                        <label>
                          Password
                          <input
                            name="password"
                            type="password"
                            required
                            minLength={mode === "signup" ? 12 : 1}
                            autoComplete={
                              mode === "signup"
                                ? "new-password"
                                : "current-password"
                            }
                          />
                        </label>
                      )}
                      {mode === "signup" && (
                        <p className="muted">
                          Use at least 12 characters for your password.
                        </p>
                      )}
                      <button disabled={busy}>
                        {busy
                          ? "Please wait…"
                          : mode === "signup"
                            ? "Create account"
                            : mode === "reset"
                              ? "Send reset email"
                              : "Sign in"}
                      </button>
                    </form>
                    <div className="auth-links">
                      <button
                        className="plain"
                        onClick={() =>
                          setMode(mode === "signup" ? "signin" : "signup")
                        }
                      >
                        {mode === "signup"
                          ? "Already registered? Sign in"
                          : "Create an account"}
                      </button>
                      <button
                        className="plain"
                        onClick={() =>
                          setMode(mode === "reset" ? "signin" : "reset")
                        }
                      >
                        {mode === "reset"
                          ? "Back to sign in"
                          : "Forgot password?"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {path === "/customer" && (
              profile?.active && profile.role === "customer" ? <>
                <div className="dashboard-banner"><span className="eyebrow">YOUR NEIGHBOURHOOD, MORE REWARDING</span><h1>Welcome back{profile.name ? `, ${profile.name}` : ""}.</h1><p>Your Customer Hub. Track purchases and find your next local favourite.</p><Link className="button" href="/deals">Explore offers <ArrowRight size={18} /></Link></div>
                <div className="dashboard-stats">
                  <div className="panel"><span>Your orders</span><strong>{orders.length}</strong></div>
                  <div className="panel"><span>In progress</span><strong>{orders.filter(o => !["completed", "cancelled"].includes(o.status)).length}</strong></div>
                  <div className="panel"><span>Items in your cart</span><strong>{Object.values(cart).reduce((a,b) => a+b,0)}</strong></div>
                </div>
                <div className="section-heading"><h2>Recent orders</h2><Link href="/orders">View all orders →</Link></div>
                {orders.length ? orders.slice(0,3).map(o => <div className="panel order" key={o.id}><div className="section-heading"><h3>#{o.id.slice(0,8)}</h3><span className="badge">{o.status}</span></div><p>{o.order_items.map(i => `${i.title} × ${i.quantity}`).join(", ")}</p><strong>{money(o.total)}</strong></div>) : <div className="empty">Your first local find is waiting. <Link href="/deals">Browse offers →</Link></div>}
                <div className="filters"><Link href="/cart">Open cart</Link><Link href="/account">Manage profile</Link><button className="secondary" disabled={busy} onClick={logout}><LogOut size={16} />{busy ? "Logging out…" : "Log out"}</button></div>
              </> : <div className="empty"><h1>Customer Hub</h1><p>Sign in with an active customer account to see your orders and cart.</p><Link href={profile ? dashboardPath : "/account"}>{profile ? "Go to your dashboard" : "Sign in →"}</Link></div>
            )}
            {path === "/merchant" && (profile?.active && profile.role === "merchant" ? <Admin key={profile.id} merchant categories={categories} shops={shops.filter(s => s.owner_id === profile.id)} deals={deals.filter(d => shops.some(s => s.id === d.shop_id && s.owner_id === profile.id))} reload={load} notify={setMessage} /> : <div className="empty"><Store size={36} /><h1>Merchant onboarding</h1>{profile?.active ? <BusinessRegistration categories={categories} /> : <><p>Sign in to register your business. Your administrator must approve it before you can publish offers.</p><Link href="/account">Sign in →</Link></>}</div>)}
            {path === "/admin" &&
              (profile?.active && profile.role === "admin" ? (
                <Admin
                  categories={categories}
                  shops={shops}
                  deals={deals}
                  reload={load}
                  notify={setMessage}
                />
              ) : (
                <div className="empty">
                  <ShieldCheck size={36} />
                  <h1>Administrator access required</h1>
                  <Link href="/account">
                    Sign in with your administrator account
                  </Link>
                </div>
              ))}
            {!isHome &&
              !nav.some(([href]) => path === href) &&
              !["/cart", "/admin", "/merchant"].includes(path) &&
              !selectedDeal &&
              !selectedShop && (
                <div className="empty">
                  <h1>Page not found</h1>
                  <Link href="/">Return home</Link>
                </div>
              )}
          </>
        )}
        <footer>
          <strong>ODAD Mart</strong>
          <span>Discover local. Save every day.</span>
          <span>₹ INR · Pay on collection</span>
        </footer>
      </main>
    </>
  );
}
