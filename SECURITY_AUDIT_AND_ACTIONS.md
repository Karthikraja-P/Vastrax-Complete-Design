# VastraX Security Audit and Action Plan

**Audit date:** 2026-11-05  
**Repository branch:** `feat/vastrax-crm-erp`  
**Deployed code commit:** `c76d20f6a48abeaa93741c22db8672da9d995a3d`

## Executive summary

A focused application and deployment security review was completed. Code-side fixes were committed and pushed. Local and remote branch heads match, the backend and 3D generator containers report healthy, and the public health endpoint returned HTTP 200 during verification.

This was a targeted configuration/code audit, not a full penetration test. Cloudflare is proxying the site and its default protection is active, but the dashboard showed **no custom security rules, no rate-limiting rules, and no managed rules**. The application has its own in-process rate limits.

## Scope

Reviewed authentication and refresh-token handling, rate limiting, client IP detection, upload bounds, API exposure, CORS/security headers, container privileges, dependency audit results, Cloudflare rules overview, and deployment health.

No intrusive brute-force or exploit traffic was sent to the public site. Secret values were not copied into this report.

## Findings and completed actions

| Area | Finding / action | Status |
|---|---|---|
| Refresh-token rotation | Refresh now fails closed if no stored token hash exists and compares token hashes safely. Refresh tokens include a random token ID so successive tokens cannot collide within the same second. | Fixed, deployed |
| Client IP trust | The app no longer trusts arbitrary `X-Forwarded-For` values. It accepts a validated Cloudflare client IP header and otherwise uses the socket peer. | Fixed, deployed |
| Rate-limit memory | Stale in-memory buckets are periodically swept and the map has a maximum size. | Fixed, deployed |
| Endpoint limits | Added limits for authentication refresh and public restock-notification subscriptions. Existing limits cover OTP, login, try-on, 3D, chat, shipping, and payment routes. OTP also has recipient-based limits. | Fixed / existing |
| Container privileges | Backend and 3D generator run as non-root users. The backend source mount is read-only. | Fixed, deployed |
| API exposure | Production API docs/OpenAPI are disabled. Backend and frontend host ports bind to loopback; the generator is not published on a public host port. | Verified |
| Upload handling | Try-on uploads have size and content-type checks. | Verified |
| Browser security headers | HSTS, frame, MIME, referrer, and permissions headers were observed on public responses. A Content-Security-Policy header was not observed. | Partial |
| Dependencies | `npm audit --omit=dev --audit-level=moderate` reported zero production advisories. Python advisory scanning is still pending. | Partial |
| Cloudflare edge rules | Dashboard showed 0 custom rules, 0 rate-limiting rules, and no managed rules configured; Cloudflare default protection is active. | Follow-up needed |

## Verification performed

- Local and remote `feat/vastrax-crm-erp` heads both resolved to `c76d20f6a48abeaa93741c22db8672da9d995a3d`.
- Backend, frontend, 3D generator, and stylist model containers were running; backend and 3D generator reported healthy.
- `https://vastrax.ai/health` returned HTTP 200 with `{"status":"ok"}`.
- `npm audit --omit=dev --audit-level=moderate`: zero production advisories.
- Python compile check and whitespace/diff checks passed.
- A manual functional check confirmed refresh-token rotation, rejection of a replayed token, rejection when the stored hash is absent, spoofed forwarding-header rejection, rate-limit enforcement, and stale-bucket cleanup.
- The full pytest suite did not run: pytest/FastAPI test dependencies are unavailable in the current test environments.

## Remaining risks

1. **Cloudflare edge throttling:** app-level limits are in process memory. They reset on backend restart and are not shared across multiple backend workers or replicas.
2. **Session revocation:** access bearer tokens can remain usable until their expiry (up to 24 hours) after logout or password reset. Password-reset tokens are stateless and valid for 30 minutes.
3. **Content Security Policy:** no CSP header was observed. A CSP should be introduced after testing compatibility with Next.js assets, Razorpay checkout, and required third-party scripts.
4. **Python dependency advisories:** no Python lockfile advisory scan has been completed.
5. **Automated regression coverage:** the targeted pytest suite and full backend suite need a test environment with test dependencies installed.
6. **Ransomware resilience:** application hardening cannot protect the host or mounted disks from ransomware. Recovery depends on separate backups and tested restoration.

## No-cost actions to take

### Priority 1: Configure Cloudflare rules

In Cloudflare for `vastrax.ai`, add narrowly scoped rate-limiting rules for:

- `POST /api/v1/auth/login`: 10 requests per IP per 10 minutes.
- `POST /api/v1/otp/send`: 5 requests per IP per 10 minutes.
- `POST /api/v1/otp/verify`: 15 requests per IP per 10 minutes.

These match the current application thresholds. Start with block or a suitable challenge only for these browser-facing authentication routes and monitor for false positives. **Do not challenge or block payment-provider or Shiprocket webhook callbacks.** Cloudflare plan limits and dashboard options can change; confirm the current plan allowance before saving rules.

### Priority 2: Backups and ransomware recovery

- Keep dated/versioned backups of the database, uploaded product media, and deployment configuration.
- Keep at least one backup disconnected from the PC or on a separate machine after the backup completes.
- Do not store production secrets in the backup report or source repository.
- Perform a restore drill periodically; a backup is useful only if it restores.

### Priority 3: Authentication and dependency hygiene

- Enable MFA for Cloudflare, GitHub, email, and administrator accounts where available.
- Use unique strong admin passwords and remove unused admin accounts.
- Add a Python dependency advisory scan (for example, `pip-audit`) to the local maintenance routine.
- Run the backend pytest suite in an environment with the project's test dependencies installed.

### Priority 4: Follow-up engineering

- Consider short-lived access tokens with a server-side session/version check so logout and password reset revoke sessions promptly.
- Add a tested CSP in report-only mode first, then enforce it after checking storefront, Razorpay, and AI integrations.
- If deployment grows beyond one backend worker, move rate-limit counters to a shared store such as self-hosted Redis or a database-backed limiter.

## Operational limitations

- In-memory rate limiting is appropriate for the current single-backend process but is not a distributed limiter.
- Cloudflare rules reduce abusive web traffic; they do not replace secure application authorization, endpoint patching, host protection, or backups.
- No claim of ransomware immunity or comprehensive penetration-test certification is made.
