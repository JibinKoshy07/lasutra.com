# LaSutra Boutique — Repo Knowledge

## Stack
- Express + pg (PostgreSQL), plain HTML/CSS/JS storefront & admin
- Frontend: `index.html`, `product.html`, `checkout.html`, `orders.html` — API URL is auto-detected once for all pages: `locations.hostname ∈ {localhost,127.0.0.1} → http://localhost:3000/api`, else `location.origin + /api`. NEVER hardcode a sandbox/work host URL (e.g. `work-*.prod-runtime.all-hands.dev`) — a hardcoded URL earlier broke the user's local dev whenever they pulled sandbox-tuned code
- Admin panel: `admin.html` — same auto-detect as above
- Backend: `backend/server.js`, `backend/db.js`

## Notable Behaviors
- **Cart persistence**: localStorage key `lasutra_cart`; index, product, checkout read it; `sessionStorage` key `lasutra_checkout_items` used for BUY NOW flow
- **Order statuses (ORDER_STATUSES in server.js)**: `['Placed','Processing','Shipped','Out for Delivery','Delivered','Cancelled','Payment Failed','Returned','Refunded']`
- **Status history**: stored in dedicated table `order_status_history` (separate from `orders`). PUT `/api/admin/orders/:id/status` appends a row. GET `/api/orders/:userId/:orderId` returns `history` (not `status_history`)
- **Admin orders search/filter**: `/api/admin/orders?q=` and `?status=` query params; frontend filters client-side too via `.orders-toolbar`

## Admin
- Seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env on first boot
- Login via POST `/api/admin/login` returns `isAdmin:true`
- ⚠ dotenv truncates env values at `#` unless quoted — password like `jibu#007` must be `'jibu#007'` in .env

## Common Docker / DB commands
- Container name: **`lasutra-pg`** (not `lasutra-postgres` or `lasutra_postgres`)
- DB name: **`lasutra`** (not `lasutra_db`); user: `postgres` (suggested by init) or `lasutra_user` if set
- Docker requires sudo in this sandbox: `sudo docker ps`

## Workflow Rules (standing)
1. **Always push to git after changes** (`git push`)
2. Keep brand design tokens consistent: Playfair Serif headings, `--color-brand` pink/red, soft beige background
3. When changing order schema, update `ORDER_STATUSES` constant AND admin/frontend renderers
4. quote dotenv values containing `#`

## Testing Locally (this sandbox)
- Backend runs on the external sandbox port (`12001`); sandbox proxy forwards `/api` there, so source code must ALWAYS use the auto-detect snippet at the top of each page (see Stack section) — direct hostnames are a footgun
- `product.html?id=N` page needs an extra ID check — renders blank if product fetch fails or JS has template literal issues
- When testing browser-side: register a user, add to cart (localStorage), then buy-now — sessionStorage carries items to checkout.html
