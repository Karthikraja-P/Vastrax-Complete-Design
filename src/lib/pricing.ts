/** Customer-facing flat delivery fee used by the storefront. */
export const SHIPPING_CHARGE = 80;
export const FREE_SHIPPING_THRESHOLD = 1499;

export function getShippingCharge(subtotal: number, hasItems: boolean): number {
  return !hasItems || subtotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;
}
