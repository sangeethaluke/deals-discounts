import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { checkoutSchema } from "../lib/models";
test("checkout input rejects invalid quantities and short contact details", () => {
  assert.equal(
    checkoutSchema.safeParse({ address: "short", items: [] }).success,
    false,
  );
});
test("database authorization, atomic checkout, price integrity, idempotency and stock restoration", async () => {
  const pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await pg.exec(readFileSync("supabase/schema.sql", "utf8"));
  await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
  const uid = "00000000-0000-4000-8000-000000000099",
    other = "00000000-0000-4000-8000-000000000098",
    deal = "00000000-0000-4000-8000-000000000040",
    req = "00000000-0000-4000-8000-000000000088";
  await pg.exec(
    `insert into auth.users values('${uid}','{}'),('${other}','{}');set role authenticated;set request.jwt.claim.sub='${uid}';`,
  );
  assert.equal((await pg.query("select * from profiles")).rows.length, 1);
  await assert.rejects(
    pg.exec(`update profiles set role='admin' where id='${uid}'`),
    /Administrator required/,
  );
  await assert.rejects(
    pg.exec(`insert into categories(name) values('Unauthorized')`),
    /row-level security/,
  );
  const order = async (quantity: number, request = req) =>
    (
      await pg.query<{ id: string }>(
        "select place_order($1::jsonb,$2,$3::uuid) as id",
        [
          JSON.stringify([{ deal_id: deal, quantity }]),
          "Test Customer, 9999999999, collect at 6pm",
          request,
        ],
      )
    ).rows[0].id;
  const oid = await order(2);
  assert.equal(await order(2), oid);
  assert.equal(
    (await pg.query<{ total: number }>("select total from orders")).rows[0]
      .total,
    259800,
  );
  assert.equal(
    (
      await pg.query<{ stock: number }>(
        `select stock from deals where id='${deal}'`,
      )
    ).rows[0].stock,
    28,
  );
  await assert.rejects(
    order(21, "00000000-0000-4000-8000-000000000087"),
    /Invalid quantity/,
  );
  await assert.rejects(
    pg.query("select change_order_status($1,$2)", [oid, "cancelled"]),
    /Administrator required/,
  );
  await pg.exec(`set request.jwt.claim.sub='${other}'`);
  assert.equal((await pg.query("select * from orders")).rows.length, 0);
  assert.equal((await pg.query("select * from order_items")).rows.length, 0);
  await pg.exec(
    `reset role;update profiles set role='admin' where id='${uid}';set role authenticated;set request.jwt.claim.sub='${uid}';`,
  );
  await pg.query("select change_order_status($1,$2)", [oid, "cancelled"]);
  await pg.query("select change_order_status($1,$2)", [oid, "cancelled"]);
  assert.equal(
    (
      await pg.query<{ stock: number }>(
        `select stock from deals where id='${deal}'`,
      )
    ).rows[0].stock,
    30,
  );
  await assert.rejects(
    pg.query("select change_order_status($1,$2)", [oid, "completed"]),
    /Invalid status transition/,
  );
  await pg.exec(`reset role; update deals set stock=1 where id='${deal}'; set role authenticated; set request.jwt.claim.sub='${other}';`);
  await assert.rejects(order(2, '00000000-0000-4000-8000-000000000086'), /no longer available/);
  assert.equal((await pg.query('select * from orders')).rows.length, 0);
  await pg.exec(`reset role; update deals set stock=30, expires_at=now()-interval '1 day' where id='${deal}'; set role authenticated;`);
  await assert.rejects(order(1, '00000000-0000-4000-8000-000000000085'), /no longer available/);
  await pg.exec(`reset role; update profiles set active=false where id='${other}'; set role authenticated;`);
  await assert.rejects(order(1, '00000000-0000-4000-8000-000000000084'), /active account/);
  // Merchants can manage only assigned listings, including hidden inventory.
  await pg.exec(`reset role; update profiles set role='merchant',active=true where id='${other}'; update shops set owner_id='${other}',active=false where id='00000000-0000-4000-8000-000000000020'; set role authenticated; set request.jwt.claim.sub='${other}';`);
  await pg.exec(`update deals set stock=12 where id='${deal}'`);
  assert.equal((await pg.query<{stock:number}>(`select stock from deals where id='${deal}'`)).rows[0].stock, 12);
  assert.equal((await pg.query(`update deals set stock=1 where id='00000000-0000-4000-8000-000000000041' returning id`)).rows.length, 0);
  await assert.rejects(pg.exec(`update shops set owner_id=null where id='00000000-0000-4000-8000-000000000020'`), /Administrator required/);
  await assert.rejects(pg.exec(`update deals set featured=false where id='${deal}'`), /Administrator required/);
  await assert.rejects(pg.exec(`update profiles set role='admin' where id='${other}'`), /Administrator required/);
  assert.equal((await pg.query('select * from orders')).rows.length, 0);
  await pg.exec(`reset role; update profiles set active=false where id='${other}'; set role authenticated;`);
  assert.equal((await pg.query(`update deals set stock=10 where id='${deal}' returning id`)).rows.length, 0);
  await pg.close();
});
