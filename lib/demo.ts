import type { Category, Shop, Deal } from "./models";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const categories: Category[] = [
  "Footwear",
  "Chicken & Meat",
  "Clothing",
  "Branded Stores",
  "Groceries",
  "Stationery",
  "Snacks",
  "Restaurants",
].map((name, i) => ({
  id: id(i + 1),
  name,
  icon: [
    "footprints",
    "beef",
    "shirt",
    "store",
    "carrot",
    "pencil",
    "cookie",
    "utensils",
  ][i],
}));
export const shops: Shop[] = [
  "Step Up Footwear",
  "Fresh Cuts Market",
  "The Cotton House",
  "Daily Basket",
  "Spice Garden",
].map((name, i) => ({
  id: id(i + 20),
  name,
  category_id: categories[[0, 1, 2, 4, 7][i]].id,
  city: "Narsapur",
  state: "Andhra Pradesh",
  address: `${12 + i * 7} Main Road, Narsapur`,
  description: [
    "Comfort for every step. Discover everyday footwear at neighbourhood prices.",
    "Fresh, carefully sourced cuts prepared by your local butcher.",
    "Easy everyday essentials and colourful styles for the whole family.",
    "Your neighbourhood stop for fresh produce and pantry essentials.",
    "Freshly prepared favourites, fragrant biryanis and family meals.",
  ][i],
  image: `/images/shop-${i}.jpg`,
  featured: true,
  restaurant: i === 4,
  active: true,
}));
export const deals: Deal[] = [
  "Everyday sneakers",
  "Fresh chicken • 1 kg",
  "Cotton casual shirt",
  "Weekly grocery bundle",
  "Family biryani combo",
].map((title, i) => ({
  id: id(i + 40),
  shop_id: shops[i].id,
  title,
  description: `Enjoy a special neighbourhood offer from ${shops[i].name}. Collect your order at the shop and pay on collection. Subject to availability; the offer applies to the listed item only.`,
  price: [129900, 19900, 69900, 49900, 59900][i],
  original_price: [199900, 28000, 119900, 69900, 89900][i],
  stock: 30,
  image: shops[i].image,
  active: true,
  featured: true,
  expires_at: "2027-12-31T23:59:59Z",
}));
