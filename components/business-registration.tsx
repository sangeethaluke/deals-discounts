"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/supabase";
import type { Category } from "@/lib/models";

export default function BusinessRegistration({ categories }: { categories: Category[] }) {
  const [options, setOptions] = useState(categories);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  useEffect(() => { setOptions(categories); }, [categories]);

  async function refreshCategories() {
    if (!db) return;
    setLoading(true);
    setCategoryError("");
    try {
      const { data, error } = await db.from("categories").select("*").order("name");
      if (error) setCategoryError("Unable to load categories. Please try again.");
      else setOptions(data || []);
    } catch {
      setCategoryError("Unable to load categories. Please check your connection.");
    } finally { setLoading(false); }
  }

  return <section className="panel">
    <h2>Register your business</h2>
    <p>Submit your business for review. An administrator will verify it and activate your merchant account.</p>
    <form className="form admin-form" onSubmit={async e => {
      e.preventDefault();
      if (!db || busy) return;
      const f = new FormData(e.currentTarget);
      if (!options.some(c => c.id === f.get("category"))) {
        setMessage("Select an available business category before submitting.");
        return;
      }
      setBusy(true);
      try {
        const { error } = await db.rpc("request_merchant_registration", {
          business_name: f.get("name"), category: f.get("category"),
          business_city: f.get("city"), business_address: f.get("address"), contact_phone: f.get("phone"),
        });
        setMessage(error ? error.message : "Registration submitted. Your business is pending administrator review.");
      } catch { setMessage("Unable to submit registration. Please try again."); }
      finally { setBusy(false); }
    }}>
      {["name", "city", "address", "phone"].map(k => <label key={k}>{k}<input name={k} required maxLength={k === "address" ? 500 : 120} defaultValue={k === "city" ? "Narsapur" : ""} /></label>)}
      <label>Category
        <select name="category" required defaultValue="" disabled={loading || !options.length} aria-describedby="registration-category-help">
          <option value="" disabled>{loading ? "Loading categories…" : options.length ? "Select your business category" : "No categories available"}</option>
          {options.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div id="registration-category-help">
        {categoryError ? <p role="alert">{categoryError}</p> : !options.length && <p role="status">No business categories have been configured. Ask your administrator to add categories, then refresh this list.</p>}
        <button type="button" className="secondary" disabled={!db || loading || busy} onClick={refreshCategories}>{loading ? "Refreshing…" : "Refresh categories"}</button>
      </div>
      <button disabled={busy || !db || loading || !options.length}>{busy ? "Submitting…" : "Submit business for review"}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
