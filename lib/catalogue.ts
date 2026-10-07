import type { Shop } from "./models";
// Identify only unchanged sample records; merchants with edited names remain visible.
const samples = new Map([
  ["00000000-0000-4000-8000-000000000020", "Step Up Footwear"],
  ["00000000-0000-4000-8000-000000000021", "Fresh Cuts Market"],
  ["00000000-0000-4000-8000-000000000022", "The Cotton House"],
  ["00000000-0000-4000-8000-000000000023", "Daily Basket"],
  ["00000000-0000-4000-8000-000000000024", "Spice Garden"],
]);
export function isSampleShop(shop: Shop) {
  return !shop.owner_id && samples.get(shop.id) === shop.name;
}
