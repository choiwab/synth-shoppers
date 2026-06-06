# Shopee Clone — End-to-End User Journey

## Purpose

We are building a **locally-hosted Shopee SG clone** in HTML/React. Real browser-use agents will browse this site and simulate the shopping journey for the **Matin Kim CozyKnit Ribbed Merino Beanie**. The goal is to measure where agents drop off (bail) and why, so we can improve the listing.

The site must look and feel like real Shopee SG. Every interactive element must be a proper HTML element (`<button>`, `<a>`, `<input>`) so browser-use can find and click it via the accessibility tree.

---

## The Full User Journey (Step by Step)

```
HOME → SEARCH → SEARCH RESULTS → PRODUCT PAGE → ADD TO CART → CART → CHECKOUT → ORDER CONFIRMED
                                                     ↓
                                               (agent bails here
                                                at any step)
```

---

## Screen 1 — Home Page

**Route:** `/`  
**Reference image:** `01-home-top.png`, `02-home-categories-flash-deals.png`

**What the user sees:**
- Orange Shopee header with search bar and cart icon
- Large hero promotional banners
- Category grid (Women's Apparel, Mobile & Gadgets, etc.)
- Flash Deals section with countdown timer and product cards
- Recommended products section

**What the user does:**
- Types "beanie" (or "matin kim") into the search bar
- Presses Enter or clicks the orange search button

**Key HTML elements needed:**
- `<input type="search">` — search bar, submits to `/search?keyword=<value>`
- `<button>` — search button
- Category tiles as `<a href="/search?keyword=<category>">` links
- Product cards as `<a href="/shopee/:id">` links

**Agent action:** Types in search bar → submits search

---

## Screen 2 — Search Results

**Route:** `/search?keyword=beanie`  
**Reference image:** `03-search-results-beanie.png`

**What the user sees:**
- Left sidebar: filter checkboxes (Shop Type, Service & Promotion, Shipped From, Shipping Option)
- Sort bar: Relevance / Latest / Top Sales / Price tabs, page indicator
- 10 product cards in a 5-column × 2-row grid, **randomised order on each load**
- Products include: **Matin Kim beanie** (the target) + 9 competitor beanies
- Each card shows: product image, price, discount badge, star rating, seller location

**What the user does:**
- Scans the results
- Identifies and clicks on the Matin Kim beanie card (or a competitor)

**Key HTML elements needed:**
- `<input type="checkbox">` — filter checkboxes with `<label>`
- Sort `<button>` tabs
- Product cards as `<a href="/shopee/:listingId">` — each card is a clickable link
- Price, rating, title visible as text inside each card

**Agent action:** Clicks on a product card → navigates to product page

---

## Screen 3 — Product Page

**Route:** `/shopee/:listingId`  
**Reference image:** `04-product-page.png`

**What the user sees:**
- Breadcrumb navigation (Shopee > Jewellery & Accessories > Hats & Caps > ...)
- Left: large product image + row of 4–5 thumbnail images below
- Right: product title, star rating + review count, price (large orange), wholesale pricing
- Shipping info, shopping guarantee
- **VARIATIONS** — colour swatch grid (click to select a variant)
- Quantity stepper (− 1 +)
- Two CTA buttons: **"Add To Cart"** (outlined) and **"Buy Now"** (solid orange)
- Below fold: product description, seller info, ratings & reviews section

**This page is the core of the simulation.** Agents evaluate:
- Photos (are they good enough?)
- Reviews (is the rating trustworthy? does the seller respond?)
- Price (is it worth it?)
- Authenticity signals (brand certificate, serial number, unboxing video)

**Key HTML elements (Matin Kim page only — H3 selector contract):**
```
data-listing-id="matinkim-beanie"       ← root element
data-gate="land"                        ← page header section (title, seller, rating visible)
data-gate="photos"                      ← gallery section
data-gate="reviews"                     ← reviews section
data-gate="price"                       ← price + variants section
data-gate="cart"                        ← add to cart section
data-action="scroll-gallery"            ← button to advance gallery
data-action="open-reviews"              ← button to expand reviews
data-action="select-variant"            ← variant colour picker
data-action="add-to-cart"               ← Add To Cart button
data-field="title"                      ← product title text
data-field="price"                      ← price display
data-field="rating"                     ← star rating score
data-field="review-count"              ← number of reviews
data-field="seller-name"               ← seller name
```

**Agent decision point:** After reading each section, the agent decides to **continue** or **bail**.
- If bail → agent exits with an objection (e.g. "Photos damn ugly leh")
- If continue → agent clicks "Add To Cart"

**Agent action:** Clicks `data-action="add-to-cart"` → triggers Screen 4

---

## Screen 4 — Add to Cart Confirmation (Toast)

**Route:** Still on `/shopee/:listingId`  
**Reference image:** `05-add-to-cart-toast.png`

**What the user sees:**
- Same product page
- **Toast overlay** appears in the centre: green checkmark + "Item has been added to your shopping cart"
- Cart icon in header now shows badge **"1"**
- Selected variant is highlighted with orange border

**What the user does:**
- Sees confirmation, then either:
  - Hovers over cart icon → sees mini cart dropdown (Screen 5)
  - Clicks cart icon directly → goes to Cart page (Screen 6)

**Key HTML elements needed:**
- Toast `<div>` that appears/disappears (CSS transition)
- Cart icon `<a href="/cart">` with badge counter `<span>`

**Agent action:** Clicks cart icon → navigates to cart

---

## Screen 5 — Mini Cart Dropdown (Hover)

**Route:** Still on `/shopee/:listingId` (hover state)  
**Reference image:** `06-cart-hover-dropdown.png`

**What the user sees:**
- Small dropdown below cart icon
- "Recently Added Products" header
- Item thumbnail + name + price
- **"View My Shopping Cart"** button

**What the user does:**
- Clicks "View My Shopping Cart" → goes to Cart page

**Key HTML elements needed:**
- Dropdown `<div>` visible on hover over cart icon
- `<button>` or `<a href="/cart">` — "View My Shopping Cart"

**Agent action:** Clicks "View My Shopping Cart" → navigates to `/cart`

---

## Screen 6 — Cart Page

**Route:** `/cart`  
**Reference image:** `07-cart-page.png`

**What the user sees:**
- Header: Shopee logo + "Shopping Cart" title
- Table with columns: Product | Unit Price | Quantity | Total Price | Actions
- Item row: checkbox, product thumbnail, name, variation selected, price, quantity stepper, total, delete button
- "Add shop voucher code" link
- Bottom bar: Platform Voucher, Shopee Coins, Select All checkbox, Delete, Move to My Likes
- Right side: **Total** amount + **"Check Out"** button (solid orange)

**What the user does:**
- Reviews items in cart
- Clicks **"Check Out"** button → goes to Checkout page

**Key HTML elements needed:**
- `<input type="checkbox">` — select item checkbox
- `<button>` — quantity stepper − and +
- `<button data-action="checkout">` — **"Check Out"** button (H3 hook)
- Item rows with price, quantity, total clearly as text

**Agent action:** Clicks `data-action="checkout"` → navigates to `/checkout`

---

## Screen 7 — Checkout Page

**Route:** `/checkout`  
**Reference image:** `08-checkout-page.png`

**What the user sees:**
- Header: Shopee logo + "Checkout" title
- Progress bar at top (dashed blue/pink lines)
- **Delivery Address** — pre-filled SG address (name, phone, full address, "Default" badge, "Change" link)
- **Products Ordered** — table: item thumbnail, name, variation, unit price (with strikethrough original), quantity, subtotal
- Shop Voucher selector
- Message for Sellers input
- **Shipping Option** — pre-selected "Get by 8 Jun | Doorstep Delivery" + fee ($1.99) + "Change" link
- Collection Points option
- "Allow to leave at doorstep" toggle (on)
- **Order Total (N Items): $XX.XX** (large orange)
- (Below fold) Shopee Voucher, Payment Method, then **"Place Order"** button

**What the user does:**
- Reviews the order summary (address, items, shipping, total)
- Clicks **"Place Order"** → order is confirmed

**Key HTML elements needed:**
- Address block (pre-filled, no editing required for simulation)
- Order summary table with readable prices
- `<button data-action="confirm-order">` — **"Place Order"** button (H3 hook)
- Total price visible as text

**Agent action:** Clicks `data-action="confirm-order"` → **agent_bought event emitted** → simulation records this agent as a successful purchase

---

## Screen 8 — Order Confirmed

**Route:** `/order-confirmed`  
**No reference image (simple screen)**

**What the user sees:**
- "Order Placed Successfully!" confirmation
- Order number
- "Continue Shopping" link back to home

**Agent action:** Simulation records `bought` outcome. Journey complete.

---

## Bail Points (Where Agents Drop Off)

At any step, an agent can decide to **bail**. The bail is recorded with:
- Which stage they were at
- Their exact objection text (in character, Singlish)

| Stage | Bail trigger | Example objection |
|---|---|---|
| `land` | Not interested from title/seller | "Never hear of this brand one." |
| `photos` | Photos not convincing | "Photos damn ugly leh, vibe not there." |
| `reviews` | Bad reviews / no seller response | "Seller never reply anyone, super sketchy." |
| `price` | Price too high or shipping fee | "Add shipping also? Forget it." |
| `cart` | Hesitation before adding | "Aiyah, maybe next time." |
| `checkout` | Last-minute doubt | "So many scams nowadays, what if fake?" |

---

## Summary Table

| # | Screen | Route | Image | Agent Action |
|---|---|---|---|---|
| 1 | Home | `/` | `01-home-top.png`, `02-home-categories-flash-deals.png` | Search "beanie" |
| 2 | Search Results | `/search?keyword=beanie` | `03-search-results-beanie.png` | Click Matin Kim card |
| 3 | Product Page | `/shopee/matinkim-beanie` | `04-product-page.png` | Browse photos/reviews/price → Add To Cart |
| 4 | Add-to-Cart Toast | `/shopee/matinkim-beanie` | `05-add-to-cart-toast.png` | See confirmation → click cart |
| 5 | Mini Cart Dropdown | `/shopee/matinkim-beanie` | `06-cart-hover-dropdown.png` | Click "View My Shopping Cart" |
| 6 | Cart Page | `/cart` | `07-cart-page.png` | Click "Check Out" |
| 7 | Checkout Page | `/checkout` | `08-checkout-page.png` | Click "Place Order" |
| 8 | Order Confirmed | `/order-confirmed` | *(no image)* | Journey complete → `bought` |

---

## What the Build Agent Needs to Know

1. **All screens are one Vite + React SPA** with React Router. Routes: `/`, `/search`, `/shopee/:listingId`, `/cart`, `/checkout`, `/order-confirmed`, `/report/:runId`

2. **Visual target:** Match the Shopee SG screenshots as closely as possible. Orange = `#ee4d2d`. White background pages for cart/checkout.

3. **The Matin Kim product page** (`/shopee/matinkim-beanie`) is config-driven — it reads from a `ListingConfig` JSON so the recommendation engine can mutate it and re-render. All other product pages are hardcoded.

4. **10 beanies on the search results page** — Matin Kim + 9 competitors. All get real product pages. Order is randomised on each load.

5. **Cart state** is managed in a global store (zustand). Adding to cart from any product page updates the cart icon badge and cart page.

6. **Checkout is pre-filled** — no real form validation needed. Delivery address, payment method all pre-populated. Agent just needs to click "Place Order".

7. **`data-action` and `data-gate` hooks** must be present on the Matin Kim product page, the cart page, and the checkout page exactly as specified above. These are how H3's browser-use driver navigates deterministically.

8. **Post-run reporting** at `/report/:runId` shows Analytics, Recommendations, and Viability tabs. These are read-only views of simulation results from the backend. Build against `fixtures/report.sample.json` until the backend is ready.
