import { test } from "node:test";
import assert from "node:assert/strict";
import { pricingScenario } from "../lib/pricing";
test("pilot includes unit costs and fees and exposes losses", () => {
 const s = pricingScenario(800, 900, 50, 1000)!;
 assert.equal(s.profit, -150);
 assert.equal(s.margin, -18.75);
 assert.equal(s.discount, 20);
 assert.equal(s.breakEven, 950);
 assert.equal(pricingScenario(0, 0, 0, 100), null);
 assert.equal(pricingScenario(101, 10, 0, 100), null);
 assert.equal(pricingScenario(100, NaN, 0, 100), null);
});
