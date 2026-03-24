# E-Commerce WebApp Specification

## 1. Project Overview
- **Project Name**: LaSutra Boutique
- **Type**: Single-page e-commerce webapp
- **Core Functionality**: A stylish boutique shopping experience with product browsing, cart management, and checkout simulation
- **Target Users**: Online shoppers looking for fashion items

## 2. UI/UX Specification

### Layout Structure
- **Header**: Fixed navigation bar with logo, menu links, and cart icon with item count
- **Hero Section**: Full-width banner with tagline and CTA button
- **Products Section**: Grid of product cards (4 columns desktop, 2 tablet, 1 mobile)
- **Cart Sidebar**: Slide-out panel from right side
- **Footer**: Multi-column footer with links and newsletter signup

### Responsive Breakpoints
- Desktop: > 1024px (4-column grid)
- Tablet: 768px - 1024px (2-column grid)
- Mobile: < 768px (1-column grid)

### Visual Design

#### Color Palette
- **Primary**: #1a1a2e (Deep Navy)
- **Secondary**: #16213e (Dark Blue)
- **Accent**: #e94560 (Coral Pink)
- **Background**: #0f0f1a (Near Black)
- **Surface**: #1f1f35 (Card Background)
- **Text Primary**: #ffffff
- **Text Secondary**: #a0a0b0
- **Success**: #00d9a5 (Mint Green)

#### Typography
- **Headings**: "Playfair Display", serif (elegant, fashion-forward)
- **Body**: "DM Sans", sans-serif (clean, readable)
- **Logo**: "Playfair Display", italic
- **Sizes**: 
  - H1: 3.5rem
  - H2: 2.5rem
  - H3: 1.5rem
  - Body: 1rem
  - Small: 0.875rem

#### Spacing System
- Base unit: 8px
- Section padding: 80px vertical
- Card padding: 24px
- Grid gap: 32px
- Container max-width: 1400px

#### Visual Effects
- Card hover: translateY(-8px) with box-shadow expansion
- Button hover: scale(1.05) with brightness increase
- Cart sidebar: slideIn from right with backdrop blur
- Product images: subtle zoom on hover
- Page load: staggered fade-in animation for products
- Smooth scroll behavior

### Components

#### Header
- Logo (left): "LaSutra" in Playfair Display italic
- Navigation (center): Home, Shop, About, Contact
- Cart Icon (right): Shopping bag with badge showing item count
- Sticky on scroll with backdrop blur

#### Hero Section
- Full viewport height minus header
- Background: Gradient overlay on abstract shape
- Headline: "Redefine Your Style"
- Subheadline: "Curated fashion for the modern individual"
- CTA Button: "Shop Now" - Coral Pink background

#### Product Card
- Image container with aspect ratio 4:5
- Product name (DM Sans, bold)
- Category label (small, muted)
- Price (Coral Pink accent)
- "Add to Cart" button (full width)
- Hover: image zoom, card lift, shadow glow

#### Cart Sidebar
- Slide-in from right
- Dark overlay on rest of page
- Header: "Your Bag" with close button
- Cart items list (scrollable)
- Each item: thumbnail, name, quantity controls, price, remove button
- Subtotal calculation
- "Checkout" button (full width, accent color)
- Empty state message when cart is empty

#### Footer
- 4 columns: About, Quick Links, Customer Service, Newsletter
- Newsletter signup form
- Social media icons
- Copyright text

## 3. Functionality Specification

### Core Features
1. **Product Display**: Show 8 sample products with images, names, categories, prices
2. **Add to Cart**: Click button adds product to cart, updates cart count
3. **Cart Management**: 
   - View all cart items in sidebar
   - Increase/decrease quantity
   - Remove items
   - See subtotal
4. **Cart Toggle**: Click cart icon opens/closes sidebar
5. **Smooth Animations**: All interactions have smooth transitions
6. **Responsive Design**: Works on all screen sizes

### User Interactions
- Click product "Add to Cart" → Item added, cart count updates, brief animation
- Click cart icon → Sidebar slides in
- Click outside sidebar or X → Sidebar closes
- Click +/- in cart → Quantity updates, subtotal recalculates
- Click remove → Item removed with animation
- Click "Checkout" → Alert message (demo only)

### Data Handling
- Products: Hardcoded array of 8 products
- Cart: JavaScript array stored in memory (no persistence)
- State: Reactive updates to UI on cart changes

### Edge Cases
- Empty cart: Show "Your bag is empty" message
- Zero quantity: Remove item from cart
- Maximum quantity: Cap at 10 per item
- Long product names: Truncate with ellipsis

## 4. Acceptance Criteria

### Visual Checkpoints
- [ ] Dark theme with coral pink accents is visible
- [ ] Playfair Display font loads for headings
- [ ] Product grid displays 4 columns on desktop
- [ ] Cards have hover lift effect
- [ ] Cart sidebar slides smoothly
- [ ] Hero section has gradient background
- [ ] Staggered animation on page load

### Functional Checkpoints
- [ ] Clicking "Add to Cart" adds item and updates badge
- [ ] Cart sidebar shows correct items
- [ ] Quantity controls work (+/-)
- [ ] Remove button removes item
- [ ] Subtotal calculates correctly
- [ ] Cart icon click opens/closes sidebar
- [ ] Responsive layout works at all breakpoints

## 5. Product Data

```javascript
const products = [
  { id: 1, name: "Silk Evening Gown", category: "Dresses", price: 289, image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop" },
  { id: 2, name: "Leather Biker Jacket", category: "Outerwear", price: 345, image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop" },
  { id: 3, name: "Cashmere Sweater", category: "Knitwear", price: 199, image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop" },
  { id: 4, name: "Tailored Trousers", category: "Bottoms", price: 159, image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop" },
  { id: 5, name: "Linen Summer Dress", category: "Dresses", price: 175, image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop" },
  { id: 6, name: "Denim Jacket", category: "Outerwear", price: 189, image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&h=500&fit=crop" },
  { id: 7, name: "Silk Blouse", category: "Tops", price: 145, image: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=400&h=500&fit=crop" },
  { id: 8, name: "Pleated Midi Skirt", category: "Bottoms", price: 129, image: "https://images.unsplash.com/photo-1583496661160-fb5886a0uj5b?w=400&h=500&fit=crop" }
];
```
