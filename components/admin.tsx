"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/supabase";
import {
  money,
  type Category,
  type Shop,
  type Deal,
  type Profile,
  type Order,
} from "@/lib/models";
import PricingPilot from "./pricing-pilot";
type Tab = "shops" | "categories" | "deals" | "users" | "orders";
export default function Admin({
  categories,
  shops,
  deals,
  reload,
  notify,
  merchant = false,
}: {
  merchant?: boolean;
  categories: Category[];
  shops: Shop[];
  deals: Deal[];
  reload: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("shops"),
    [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [users, setUsers] = useState<Profile[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [busy, setBusy] = useState(false),
    [applications, setApplications] = useState<{id:string;user_id:string;name:string;city:string;address:string;phone:string;category_id:string}[]>([]),
    [uploadedImage, setUploadedImage] = useState<string | null>(null),
    [registrationsLoading, setRegistrationsLoading] = useState(!merchant),
    [registrationsError, setRegistrationsError] = useState("");
  async function refresh() {
    if (merchant) return;
    if (!db) {
      setRegistrationsError("Connect Supabase to load business registrations.");
      setRegistrationsLoading(false);
      return;
    }
    setRegistrationsLoading(true);
    setRegistrationsError("");
    try {
      const [u, o, requests] = await Promise.all([
        db.from("profiles").select("*").order("name"),
        db.from("orders").select("*,order_items(*)").order("created_at", { ascending: false }),
        db.from("merchant_applications").select("*").eq("status", "pending"),
      ]);
      if (u.error || o.error) notify(u.error?.message || o.error!.message);
      if (requests.error) {
        setRegistrationsError(
          ["PGRST205", "42P01"].includes(requests.error.code)
            ? "Merchant registration tables are missing. Apply the merchant registration migration in Supabase, then refresh requests."
            : `Unable to load registrations: ${requests.error.message}`,
        );
      } else setApplications(requests.data || []);
      setUsers(u.data || []);
      setOrders(o.data || []);
    } catch {
      setRegistrationsError("Unable to load registrations. Check your connection and refresh requests.");
    } finally {
      setRegistrationsLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function mutate(
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(true);
    try {
      const { error } = await action();
      if (error) notify(error.message);
      else {
        notify("Changes saved.");
        setEditing(null);
        await reload();
        await refresh();
      }
    } catch {
      notify("Unable to save changes. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const rows =
    tab === "shops" ? shops : tab === "categories" ? categories : deals;
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{merchant ? "YOUR BUSINESS, AT A GLANCE" : "MARKETPLACE OPERATIONS"}</span>
          <h1>{merchant ? "Merchant Studio" : "Admin Console"}</h1>
          <p>{merchant ? "Manage your shops, keep stock up to date, and publish your next offer." : "Manage shops, offers, customers, and orders across your marketplace."}</p>
        </div>
      </div>
      <div className="dashboard-stats">
        <div className="panel"><span>Shops</span><strong>{shops.length}</strong></div>
        <div className="panel"><span>Active offers</span><strong>{deals.filter(d => d.active && d.stock > 0 && new Date(d.expires_at) > new Date()).length}</strong></div>
        <div className="panel"><span>{merchant ? "Low-stock offers" : "Customers"}</span><strong>{merchant ? deals.filter(d => d.stock <= 5).length : users.filter(u => u.role === "customer").length}</strong></div>
      </div>
      {merchant && <PricingPilot />}
      {!merchant && <section className="panel" aria-labelledby="business-registrations-heading">
        <div className="section-heading">
          <h2 id="business-registrations-heading">Business registrations</h2>
          <button className="secondary" disabled={registrationsLoading || busy} onClick={refresh}>Refresh requests</button>
        </div>
        {registrationsLoading ? <p role="status">Loading registrations…</p>
          : registrationsError ? <p role="alert">{registrationsError}</p>
          : applications.length ? applications.map(a => <div key={a.id}>
              <h3>{a.name} · {a.city}</h3>
              <p>{categories.find(c => c.id === a.category_id)?.name} · {a.address} · {a.phone}</p>
              <button disabled={busy} onClick={() => mutate(() => db!.rpc("approve_merchant_registration", {application_id:a.id}))}>Approve merchant and create shop</button>
            </div>)
          : <p>No pending business registrations. Merchants must submit “Register your business” after signing in; selecting Merchant at signup does not submit a request.</p>}
      </section>}
      {merchant && !shops.length && <p className="empty">No shops assigned yet. Ask your marketplace administrator to assign your shop to your account.</p>}
      <div className="filters">
        {((merchant ? ["shops", "deals"] : ["shops", "categories", "deals", "users", "orders"]) as Tab[]).map(
          (t) => (
            <button
              className={tab === t ? "selected" : "secondary"}
              key={t}
              onClick={() => {
                setTab(t);
                setEditing(null);
              }}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {["shops", "categories", "deals"].includes(tab) && (
        <>
          {(!merchant || (tab === "deals" && shops.length > 0)) && <button onClick={() => { setUploadedImage(null); setEditing({}); }}>
            + Add {tab === "categories" ? "category" : tab.slice(0, -1)}
          </button>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{"title" in r ? r.title : r.name}</td>
                    <td>
                      {"price" in r
                        ? `${money(r.price)} · Stock ${r.stock}`
                        : "city" in r
                          ? r.city
                          : "Category"}
                      {"active" in r && !r.active ? " · Hidden" : ""}
                    </td>
                    <td>
                      <button
                        className="secondary"
                        onClick={() => setEditing({ ...r })}
                      >
                        Edit
                      </button>{" "}
                      {!merchant && <button
                        className="plain"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this record? Referenced records cannot be deleted. Hide a shop or deal instead to preserve order history.",
                            )
                          )
                            mutate(() => db!.from(tab).delete().eq("id", r.id));
                        }}
                      >
                        Delete
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {editing && (
        <section className="panel">
          <h2>
            {editing.id ? "Edit" : "Add"} {tab.slice(0, -1)}
          </h2>
          <form
            className="form admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body: Record<string, unknown> = {};
              for (const [k, v] of f.entries()) body[k] = v;
              if (uploadedImage) body.image = uploadedImage;
              for (const k of ["featured", "active", "restaurant"])
                if (
                  tab !== "categories" &&
                  (k !== "restaurant" || tab === "shops")
                )
                  body[k] = f.has(k);
              if (tab === "shops" && !merchant) body.owner_id = f.get("owner_id") || null;
              if (merchant) delete body.featured;
              if (tab === "deals") {
                for (const k of ["price", "original_price", "stock"])
                  body[k] = k === "stock" ? Number(f.get(k)) : Math.round(Number(f.get(k)) * 100);
                body.expires_at = new Date(
                  String(f.get("expires_at")),
                ).toISOString();
                if (Number(body.price) > Number(body.original_price)) {
                  notify("Original price must be at least the offer price.");
                  return;
                }
              }
              mutate(() =>
                editing.id
                  ? db!.from(tab).update(body).eq("id", editing.id)
                  : db!.from(tab).insert(body),
              );
            }}
          >
            {(tab === "deals"
              ? [
                  "title",
                  "description",
                  "image",
                  "price",
                  "original_price",
                  "stock",
                  "expires_at",
                ]
              : tab === "shops"
                ? ["name", "description", "city", "state", "address", "image"]
                : ["name", "icon"]
            ).map((k) => (
              <label key={k}>
                {(
                  {
                    original_price: "Normal price (₹)",
                    price: "Deal price (₹)",
                    expires_at: "Offer expiry",
                    image: "Image URL (HTTPS, optional)",
                  } as Record<string, string>
                )[k] || k}
                <input
                  name={k}
                  defaultValue={
                    k === "expires_at" && editing[k]
                      ? new Date(String(editing[k])).toISOString().slice(0, 16)
                      : ["price", "original_price"].includes(k) && editing[k] != null ? String(Number(editing[k]) / 100) : String(editing[k] ?? "")
                  }
                  type={
                    ["price", "original_price", "stock"].includes(k)
                      ? "number"
                      : k === "expires_at"
                        ? "datetime-local"
                        : "text"
                  }
                  step={["price", "original_price"].includes(k) ? "0.01" : undefined}
                  min={k === "stock" ? 0 : 0.01}
                  max={
                    ["price", "original_price"].includes(k)
                      ? 100000000
                      : undefined
                  }
                  maxLength={k === "description" ? 2000 : 500}
                  pattern={k === "image" ? "https://.*" : undefined}
                  required={!["image", "description"].includes(k)}
                />
              </label>
            ))}
            {tab !== "categories" && <label>Take or upload a product photograph<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={async e => { const file=e.target.files?.[0]; if(!file || !db) return; if(file.size > 5*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(file.type)) { notify("Choose a JPG, PNG or WebP under 5 MB."); return; } setBusy(true); try { const {data:{user}}=await db.auth.getUser(); if(!user) throw new Error("Sign in to upload."); const extension=file.type.split("/")[1]; const key=`${user.id}/${crypto.randomUUID()}.${extension}`; const {error}=await db.storage.from("product-images").upload(key,file); if(error) throw error; setUploadedImage(db.storage.from("product-images").getPublicUrl(key).data.publicUrl); notify("Photo uploaded. Save to attach it to your listing."); } catch(error) { notify(error instanceof Error ? error.message : "Photo upload failed."); } finally {setBusy(false);} }}/>{uploadedImage && <img src={uploadedImage} alt="Uploaded listing preview" width="160" />}</label>}
            {tab === "shops" && !merchant && <label>Shopkeeper
              <select name="owner_id" defaultValue={String(editing.owner_id || "")}>
                <option value="">Unassigned</option>
                {users.filter(u => u.role === "merchant" && u.active).map(u => <option key={u.id} value={u.id}>{u.name || u.id}</option>)}
              </select>
            </label>}
            {tab === "shops" && (
              <label>
                Category
                <select
                  name="category_id"
                  defaultValue={String(
                    editing.category_id || categories[0]?.id,
                  )}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tab === "deals" && (
              <label>
                Shop
                <select
                  name="shop_id"
                  defaultValue={String(editing.shop_id || shops[0]?.id)}
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tab !== "categories" && (
              <>
                {[
                  "active",
                  "featured",
                  ...(tab === "shops" ? ["restaurant"] : []),
                ].filter(k => !merchant || k !== "featured").map((k) => (
                  <label className="check" key={k}>
                    <input
                      type="checkbox"
                      name={k}
                      defaultChecked={Boolean(editing[k] ?? k === "active")}
                    />
                    {k === "active" ? "Available / published" : k}
                  </label>
                ))}
              </>
            )}
            <div>
              <button disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>{" "}
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {tab === "users" && (
        <div className="table-wrap">
          <p>
            Customers can be suspended without deleting their order history.
            Role changes take effect at the database.
          </p>
          <table>
            <thead>
              <tr>
                <th>Name / ID</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name || "Unnamed customer"}
                    <small>{u.id}</small>
                  </td>
                  <td>{u.phone}</td>
                  <td>
                    <select
                      aria-label={`Role for ${u.name}`}
                      disabled={busy}
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value;
                        if (
                          window.confirm(`Change ${u.name || u.id} to ${role}?`)
                        )
                          mutate(() =>
                            db!
                              .from("profiles")
                              .update({ role })
                              .eq("id", u.id),
                          );
                      }}
                    >
                      <option>customer</option>
                      <option>merchant</option>
                      <option>admin</option>
                    </select>
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() =>
                        mutate(() =>
                          db!
                            .from("profiles")
                            .update({ active: !u.active })
                            .eq("id", u.id),
                        )
                      }
                    >
                      {u.active ? "Suspend" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "orders" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Items / Contact</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    #{o.id.slice(0, 8)}
                    <small>{new Date(o.created_at).toLocaleString()}</small>
                  </td>
                  <td>
                    {o.order_items
                      .map((i) => `${i.title} × ${i.quantity}`)
                      .join(", ")}
                    <small>{o.address}</small>
                  </td>
                  <td>{money(o.total)}</td>
                  <td>
                    <select
                      aria-label="Order status"
                      disabled={busy}
                      value={o.status}
                      onChange={(e) =>
                        mutate(() =>
                          db!.rpc("change_order_status", {
                            order_id: o.id,
                            new_status: e.target.value,
                          }),
                        )
                      }
                    >
                      {[
                        "placed",
                        "confirmed",
                        "ready",
                        "completed",
                        "cancelled",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
