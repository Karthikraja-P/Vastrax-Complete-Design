# Shiprocket shipment status updates

VastraX accepts courier tracking callbacks at:

```text
https://vastrax.ai/api/v1/shipping/status-callback
```

The endpoint authenticates Shiprocket's `x-api-key` header against
`SHIPROCKET_WEBHOOK_TOKEN` in the root `.env`. The token is generated locally
and is not committed. The backend container must be recreated after changing
it:

```bash
docker compose up -d --force-recreate backend
```

In the Shiprocket dashboard, open **Settings → API → Webhooks**, add the URL,
set the security token to the value of `SHIPROCKET_WEBHOOK_TOKEN`, enable the
webhook, and save. Shiprocket should send tracking updates as JSON POSTs.

Callbacks are matched by AWB, or by shipment ID when an AWB is absent. The
latest courier status is saved to the order. Pickup / handover / transit /
out-for-delivery events move the order to `shipped`; a delivered event moves
it to `delivered`. The admin Orders page and the customer's **My Account →
Orders & Shipments** view show the latest courier milestone. Delivered status
is protected from late, older callbacks. Unknown shipment callbacks are logged
and acknowledged with HTTP 200 to prevent unnecessary provider retries.
