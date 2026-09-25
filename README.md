# 🌐 IPDokan Telegram Proxy Store Bot & Admin Dashboard

A complete, production-ready Telegram e-commerce ecosystem built for **[ipdokan.com](https://ipdokan.com)**. Customers can browse **Proxy GB** (bandwidth/traffic packages) and **Proxy IP** (IP-count packages), pick brands (_9proxy, Cliproxy, 711Proxy, Loki Proxy, NovProxy, Proxy001, Supproxy, IPROCKET_), checkout via the website's payment gateway (bKash, Nagad, Rocket, Binance, Wallet), and receive proxy credentials automatically inside Telegram.

Includes a **React + Tailwind CSS** admin panel for tracking orders, managing proxy stock, and syncing products.

---

## 🚀 Key Features

- 🤖 **Telegram Bot (Telegraf + Node.js)**:
  - Welcome menu with interactive inline keyboard navigation.
  - **Type Selector**: Choose between `🌐 Proxy GB` and `🔢 Proxy IP`.
  - **Live Brand & Package Sync**: Pulls real products, variations, prices, and stock from `ipdokan.com` via WooCommerce REST API.
  - **Out-of-Stock Protection**: Out of stock packages show `[Stock Out]` and prevent ordering.
  - **Direct Website Checkout**: Generates checkout link with the product pre-added to cart / WooCommerce order payment link.
  - `/myorders` command displaying customer purchase history and delivered credentials.
  - Admin commands: `/stats` (live revenues & order totals) and `/addstock`.

- 🛒 **WooCommerce & Gateway Integration**:
  - Live WooCommerce REST API client in [`services/woocommerce.js`](file:///Users/apple/Desktop/AI_BOT/services/woocommerce.js).
  - Server-to-server WooCommerce Webhook receiver (`POST /webhook/woocommerce`).
  - Automatic stock reduction by WooCommerce on checkout completion.
  - Automated instant credential delivery into customer Telegram chat upon successful payment.
  - Optional fallback to standalone SSLCommerz gateway (`POST /webhook/payment-ipn`).

- ⚡ **Atomic Proxy Credential Management (MongoDB + Mongoose)**:
  - Concurrency-safe atomic credential reservation via `findOneAndUpdate({ isUsed: false })`.
  - When payment is received, the bot checks its credential pool for that product/variation and delivers it to the customer.
  - If stock was not pre-uploaded in the bot, the admin is immediately alerted on Telegram with customer details and order ID, and the customer is politely informed that their proxy is being provisioned.

- 🎛 **Admin Web Dashboard (React + Vite + Tailwind CSS)**:
  - **Overview**: Revenue analytics (Today, Week, All-time), active order counts, low-stock warnings.
  - **Products**: Manage brands and packages, or hit **"Sync with WooCommerce"** to automatically pull all products from `ipdokan.com`.
  - **Stock Inventory**: Bulk paste proxy credentials (one per line) or drag-and-drop text files.
  - **Orders Audit**: View all orders, search by ID, @username, or Telegram ID, and manually fulfill/deliver proxies with one click.

---

## 📁 Project Structure

```
├── bot/
│   ├── config/strings.js       # Centralized user-facing copy (Bengali & English)
│   ├── handlers/
│   │   ├── admin.js            # /stats and interactive /addstock wizard
│   │   └── customer.js         # /start, GB vs IP, brand/variation navigation, /myorders, /help
│   ├── keyboards.js            # Type, brand, variation, and checkout inline keyboards
│   └── index.js                # Telegraf bot initialization & polling launcher
├── server/
│   ├── middleware/auth.js      # JWT authentication for admin REST API
│   ├── routes/
│   │   ├── api.js              # Admin REST endpoints (Stats, WooCommerce Sync, Stock, Orders)
│   │   └── webhook.js          # WooCommerce webhook & SSLCommerz IPN receiver
│   ├── db.js                   # MongoDB connection manager
│   └── index.js                # Express app setup and HTTP server
├── models/
│   ├── Brand.js                # Proxy vendor schema
│   ├── Plan.js                 # Quota and pricing package schema
│   ├── Stock.js                # Proxy credentials repository schema
│   ├── Order.js                # Order and transaction audit schema (with wooOrderId)
│   ├── User.js                 # Customer analytics schema
│   └── Admin.js                # Admin dashboard user schema
├── services/
│   ├── woocommerce.js          # WooCommerce REST API v3 client for ipdokan.com
│   ├── payment.js              # SSLCommerz session creation & validation
│   ├── stockService.js         # Atomic FIFO allocation & bulk import engine
│   └── notifyAdmin.js          # Telegram admin alerts for sales & empty stock
├── admin-panel/                # React (Vite) + Tailwind CSS dashboard
│   ├── src/
│   │   ├── components/Sidebar.jsx
│   │   ├── pages/Dashboard.jsx
│   │   ├── pages/Products.jsx
│   │   ├── pages/Stock.jsx
│   │   ├── pages/Orders.jsx
│   │   ├── pages/Login.jsx
│   │   ├── api.js
│   │   └── App.jsx
│   └── vite.config.js
├── scripts/
│   └── seed.js                 # Seeds admin account & syncs products from ipdokan.com
├── .env.example
├── package.json
└── README.md
```

---

## ⚙️ Configuration & Environment Variables

All settings are stored in `.env`:

```ini
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token
ADMIN_IDS=123456789              # Your Telegram numeric ID (get from @userinfobot)
SUPPORT_CONTACT=@ipdokan

# Server & Database
PORT=5001
APP_BASE_URL=http://localhost:5001
MONGODB_URI=mongodb+srv://aibot:aibot1231@cluster0.u4vokrk.mongodb.net/telegram_proxy_store?retryWrites=true&w=majority&appName=Cluster0

# WooCommerce Integration (ipdokan.com)
WOOCOMMERCE_URL=https://ipdokan.com
WOOCOMMERCE_CONSUMER_KEY=ck_your_read_write_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=cs_your_consumer_secret
WOOCOMMERCE_WEBHOOK_SECRET=generate_a_long_random_webhook_secret

# Admin Dashboard
JWT_SECRET=generate_a_long_random_jwt_secret
ADMIN_PANEL_USERNAME=your_admin_username
ADMIN_PANEL_PASSWORD=use_a_strong_password
```

---

## 🛠 Setup & Running

### 1. Seed Database & Sync WooCommerce Products

```bash
npm run seed
```

This will:

1. Verify/create the default admin credentials (`admin` / `admin123`).
2. Connect to `ipdokan.com` and automatically populate all GB and IP products and variations with live pricing.

### 2. Start Backend & Bot Concurrently

```bash
npm run dev
```

- Express server runs on `http://localhost:5001`.
- Telegram bot starts in polling mode with token `8562022376:...`.

### 3. Launch React Admin Panel

In a second terminal:

```bash
cd admin-panel
npm run dev
```

Open `http://localhost:3000` and log in with:

- **Username:** `admin`
- **Password:** `admin123`

---

## 📡 Connecting the WooCommerce Webhook

When a customer pays on `ipdokan.com`, WooCommerce sends an instant notification to deliver the proxy.

### Setting up the Webhook in WordPress Admin:

1. Log into your WordPress admin at `https://ipdokan.com/wp-admin`.
2. Navigate to **WooCommerce** → **Settings** → **Advanced** → **Webhooks**.
3. Click **Add webhook**:
   - **Name:** Telegram Bot Order Delivery
   - **Status:** `Active`
   - **Topic:** `Order updated` (or `Order created`)
   - **Delivery URL:** `https://your-domain.com/webhook/woocommerce` _(For local testing, use your ngrok URL, e.g., `https://xxxx.ngrok-free.app/webhook/woocommerce`)_
   - **Secret:** the same long random value you set in `WOOCOMMERCE_WEBHOOK_SECRET`
   - **API Version:** `WP REST API Integration v3`
4. Click **Save Webhook**.

---

## 🧪 Local Testing with ngrok

To test the WooCommerce webhook on your local development machine:

1. Expose port 5001:
   ```bash
   ngrok http 5001
   ```
2. Copy your forwarding URL (e.g. `https://abc1234.ngrok-free.app`).
3. Set the WooCommerce Webhook Delivery URL to `https://abc1234.ngrok-free.app/webhook/woocommerce`.
4. Send `/start` to your Telegram bot, pick **Proxy GB** or **Proxy IP**, choose a plan, and tap **"💳 Pay on Website"**!

---

## 📜 Available Scripts

| Command                           | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `npm run dev`                     | Runs Express server & Telegram bot in watch mode  |
| `npm run dev:server`              | Starts Express server on port 5001                |
| `npm run dev:bot`                 | Starts Telegram bot in polling mode               |
| `npm run seed`                    | Syncs all products from ipdokan.com into database |
| `cd admin-panel && npm run dev`   | Runs Vite React development server on port 3000   |
| `cd admin-panel && npm run build` | Builds production assets for admin panel          |
