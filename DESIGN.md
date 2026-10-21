# VastraX storefront direction

## Brief

VastraX is a women's fashion storefront whose current catalog is coordinated two-piece sets. Visitors should understand the edit quickly, browse real products, and reach product details or the shopping bag without being distracted by decorative UI. Keep the current warm neutral product photography, dark ink, and restrained copper accent. Do not change the admin visual system as part of this storefront pass.

## Concept studies

| Concept | Layout and motion | Signature frame | Anchor | Originality / fit / feasibility / portability |
| --- | --- | --- | --- | --- |
| **One complete look** | Lead with the full coordinated set, then show it consistently from collection card to product detail. Product imagery grows subtly on hover; controls stay still and clear. | A row of complete two-piece looks on a pale fitting-room stage. | VastraX sells the top and its matching bottom as one product. | 4 / 5 / 5 / 1 |
| **The textile palette** | Arrange the edit by fabric color and let each color family define a section. | A quiet run from beige through pink and green. | The current pieces have distinct textile colors. | 3 / 4 / 4 / 3 |
| **A measuring room** | Use size-guide proportions and measured labels as the main grid. | Product image next to a compact fit reference. | The store has a women's size guide. | 3 / 4 / 4 / 2 |

**Selected:** One complete look. It is tied to the products' actual construction and scales to future coordinated sets without inventing claims or changing the brand palette.

## System

- **Palette:** garment paper #FBF9F6 (ground), dark umber #29231F (ink), taupe #6F6257 (muted), warm stone #E5DED6 (line), existing VastraX copper #E07A3F (accent), fitting-room ivory #F5F2ED (image stage).
- **Typography:** retain the existing Outfit family and established weight range. Use larger, tightly led display copy only for the hero; keep utility text readable and calm.
- **Grid:** 12 columns on desktop, 4 on phones; 24 px gutters on desktop and 16 px on phones. Product imagery aligns to one shared stage size and baseline.
- **Shape:** rounded image stage and modestly rounded controls, no floating glass panels or heavy card shadows.
- **Motion:** garments settle into place; 180-260 ms, ease-out. Hover only enlarges the image slightly and moves the action arrow. Respect reduced motion and retain all actions on touch.
- **Genericness test:** "Show a whole coordinated outfit as one look" depends on VastraX's bundled two-piece products; replacing VastraX with a generic retailer would make the central rule false.

## Composition

Header: Home / Collections / VASTRAX / account / bag
Hero: existing hanger image, quiet left-side copy, one clear shop action
Browse: compact category links, no duplicate oversized image cards
Edit: three-column product grid, one complete product per image stage
Footer: verified store contact and policy links
Phone: compact header, hero, category links, two-column then one-column product grid

## Launch QA record

Track observable evidence in the task handoff. Do not invent analytics, legal, contact, product, or performance facts. Any external account setting or service behavior that cannot be verified from this workspace remains explicitly blocked.

### Storefront implementation review (2026-10-21)

**Verified in the local preview**

- Home, collections, product detail, and branded not-found routes render at desktop and 390 px mobile widths without horizontal overflow. Product, collection, and home accessibility scans reported zero axe violations after fixes.
- Slow-network mobile simulation measured a 1.72 s Largest Contentful Paint and 0 cumulative layout shift; the homepage hero image is prioritized and its WebP is 56,680 bytes.
- Header navigation/search, collection filters, product links, sticky mobile shopping action, and the branded not-found call to action were exercised in browser checks.
- Cookie consent was exercised in both reject and accept states. Optional Clarity script was absent before a choice and after reject; accept enabled the script in the browser test. The real Clarity account configuration still needs owner verification.
- Public page metadata, canonical/product metadata, Open Graph image, robots rules, sitemap, favicon, and the default noindex policy for account/admin/app routes are implemented.
- Lint, TypeScript, production build, and `git diff --check` passed during this work session.

**Still needs owner/service verification before public launch**

- Confirm the actual product imagery represents each coordinated two-piece set. The current Beige Coord catalog image looks like a one-piece dress in the local preview; do not treat the cutout as approved product photography without confirmation.
- Review privacy, returns, shipping, and terms copy against actual business practices and contact details.
- Verify Clarity consent mode and data collection in the production account, and verify production payment, shipping, email, authentication, and other configured services with their real credentials.
- Test checkout, account flows, and key interactions on a real Android/iOS device and against the production deployment. This work only verified the local preview and local backend.
- Confirm the release is deployed and that the production domain serves this exact revision. No push or production deployment was performed as part of this UI pass.
