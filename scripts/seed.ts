import { writeFileSync } from "node:fs";
import { categories, shops, deals } from "../lib/demo";
const sql = (v: unknown) =>
  typeof v === "boolean"
    ? String(v)
    : typeof v === "number"
      ? String(v)
      : `'${String(v).replaceAll("'", "''")}'`;
let output = "-- Demo catalogue only. No passwords or admin accounts.\n";
for (const [table, rows] of [
  ["categories", categories],
  ["shops", shops],
  ["deals", deals],
] as const) {
  for (const row of rows) {
    output += `insert into public.${table} (${Object.keys(row).join(",")}) values (${Object.values(row).map(sql).join(",")}) on conflict (id) do nothing;\n`;
  }
}
writeFileSync("supabase/seed.sql", output);
