import { z } from "zod";
export type Category = { id: string; name: string; icon: string };
export type Shop = {
  id: string;
  name: string;
  owner_id?: string | null;
  category_id: string;
  city: string;
  state: string;
  address: string;
  description: string;
  image: string;
  featured: boolean;
  restaurant: boolean;
  active: boolean;
};
export type Deal = {
  id: string;
  shop_id: string;
  title: string;
  description: string;
  price: number;
  original_price: number;
  stock: number;
  image: string;
  active: boolean;
  featured: boolean;
  expires_at: string;
};
export type Profile = {
  id: string;
  name: string;
  phone: string;
  role: "customer" | "merchant" | "admin";
  account_type?: "customer" | "merchant";
  active: boolean;
};
export type Order = {
  id: string;
  created_at: string;
  total: number;
  status: string;
  address: string;
  order_items: { title: string; quantity: number; unit_price: number }[];
};
export const checkoutSchema = z.object({
  address: z.string().trim().min(10).max(500),
  items: z
    .array(
      z.object({
        deal_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(50),
});
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
