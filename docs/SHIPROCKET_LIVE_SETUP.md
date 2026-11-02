# Shiprocket live dispatch setup

## Tracking status callback

In the Shiprocket account, add a shipment tracking webhook with:

- URL: `https://vastrax.ai/api/v1/shipping/status-callback`
- Method: `POST`
- Header: `x-api-key`
- Header value: the exact `SHIPROCKET_WEBHOOK_TOKEN` configured in the Vastrax backend environment

Keep the token private. The endpoint rejects callbacks without the configured token and updates the matching order by AWB or Shiprocket shipment ID. Confirm a test callback in Shiprocket's webhook log before relying on customer-facing tracking updates.

## Admin dispatch flow

1. Confirm payment (or confirm the order is COD), pack the order, and open its details in **Admin → Orders**.
2. Choose the pickup date and click **Assign courier, AWB & pickup**. This makes live Shiprocket API requests and schedules a real pickup, so only use it when the package is ready.
3. Open the generated manifest for printing. Courier scans then update the customer order through the tracking webhook.

The dispatch API assigns the account's default courier unless an authorized caller supplies a courier ID. It assigns the AWB, requests pickup, and then generates the manifest in Shiprocket's required order.

## Payment verification

In the live Razorpay Dashboard, add a webhook with:

- URL: `https://vastrax.ai/api/v1/payments/webhook`
- Secret: the same private value configured as `RAZORPAY_WEBHOOK_SECRET` in the backend
- Events: `payment.captured`, `payment.failed`, `refund.processed`, and `refund.failed`

The backend readiness endpoint reports whether live Razorpay configuration is present; it does not prove that the dashboard webhook is registered or that a real payment has settled. Verify one authorized low-value transaction through Razorpay Checkout and confirm its signed callback/verification and resulting order state before opening orders to customers.
