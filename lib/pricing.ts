export function pricingScenario(price: number, cost: number, fees: number, normal: number) {
  if (![price, cost, fees, normal].every(Number.isFinite) || price <= 0 || cost < 0 || fees < 0 || normal < price) return null;
  const profit = price - cost - fees;
  return { profit, margin: profit / price * 100, discount: (normal - price) / normal * 100, breakEven: cost + fees };
}
