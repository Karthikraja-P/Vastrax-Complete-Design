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

## Customer returns and reverse pickup

1. A signed-in customer opens **My Account → Orders & Shipments** and selects **Request return** on a delivered product. They choose a reason, quantity, and optional note. The request is recorded in the return queue; no Shiprocket request is made yet.
2. An admin opens **ERP → Returns**, reviews the request, chooses a pickup date, and clicks **Approve & book pickup**. Approval creates a Shiprocket return order using the customer's original delivery address as the pickup and the configured Shiprocket pickup location as the return destination. VastraX then assigns the default courier/AWB and schedules the reverse pickup.
3. The reverse AWB, courier, pickup date, and latest status are stored on the return request. Customers and admins can request current tracking; Shiprocket callbacks are matched to the reverse AWB and update the return status.
4. Once Shiprocket reports the parcel returned to VastraX, an admin records receipt and sellable quantity in ERP Returns. Only then can a refund be issued through the existing refund flow.

Approval triggers live Shiprocket API calls. If booking fails, the request remains approved with a visible failure status and the admin can retry. The return pickup address and phone are read from the configured Shiprocket pickup location; customer pickup requires a valid 10-digit phone number on the customer's account.

## NDR and courier RTO

1. Admin → Orders loads Shiprocket's live NDR list and matches AWBs to VastraX orders.
2. The admin chooses **Reattempt delivery** or **Return to origin**. VastraX rechecks that the AWB is still in Shiprocket's NDR list, then submits the selected action and admin comment. Return-to-origin is an actual Shiprocket action.
3. Tracking callbacks update the order through RTO initiated, in transit, and delivered/acknowledged. When the RTO reaches VastraX, an admin counts and inspects every item before choosing received and sellable quantities. Only the sellable quantity is added back to stock, with an ERP stock movement. Duplicate receipt is blocked.
4. Shiprocket documents acknowledging an RTO in its RTO dashboard after receipt. VastraX records the physical count locally; the admin must still use Shiprocket's dashboard to acknowledge the RTO unless Shiprocket makes an acknowledgement API available to this account.

Customer-requested returns remain a different workflow: they are initiated by the customer and require admin approval before a reverse pickup is booked. Courier RTO is initiated only from an active Shiprocket NDR case.

Customer-requested returns are limited to seven days after delivery and the remaining quantity ordered. The policy's damaged-item evidence requirement remains the parcel-opening video sent to support; in-site video upload is not part of this flow.
