/** Centralized user-facing strings for the IPDokan Telegram bot. */
module.exports = {
  welcome: (name) => `👋 <b>Welcome ${name || "Customer"} to IPDokan Proxy Store!</b>\n\n⚡ Get high-speed premium proxies at the best prices (GB bandwidth and IP-based packages).\n\n🛒 Choose your preferred proxy directly in Telegram and pay with <b>bKash, Nagad, Rocket, or Binance</b>.\n\nTap <b>"🛒 Buy Proxy"</b> below to view packages!`,
  mainMenuButton: "🏠 Main Menu",
  buyProxyButton: "🛒 Buy Proxy",
  myOrdersButton: "📦 My Orders",
  supportButton: "💬 Help & Support",
  selectCategory: "🏷 <b>Choose a Category:</b>\n\nAll active categories from our website are listed below. Select the one you need:",
  selectProduct: (categoryName) => `🏷 <b>${categoryName} - Products:</b>\n\nSelect your preferred brand or product from the list below:`,
  selectPlan: (productName) => `📦 <b>${productName} - Available Packages:</b>\n\nChoose the package you need:`,
  orderSummary: (brandName, planLabel, price, currency, orderId) => `🧾 <b>Order Confirmation</b>\n\n🏷 <b>Provider:</b> ${brandName}\n📦 <b>Package:</b> ${planLabel}\n💰 <b>Price:</b> <b>${price} ${currency}</b>\n🆔 <b>Order ID:</b> <code>${orderId}</code>\n\nClick <b>"💳 Pay on Website"</b> below to complete payment.\n<i>(You can pay directly using bKash, Nagad, Rocket, Binance, or Wallet.)</i>`,
  payButtonText: (amount, currency) => `💳 Pay on Website (${amount} ${currency})`,
  cancelButtonText: "❌ Cancel Order",
  orderCancelled: "❌ Your order has been cancelled. You can place a new order whenever you are ready.",
  outOfStockAlert: "❌ Sorry, this package is currently out of stock. Please choose another package.",
  deliverySuccess: (brandName, planLabel, credentials, orderId) => `🎉 <b>Payment received and proxy delivered!</b>\n\nYour proxy credentials are below:\n\n🏷 <b>Provider:</b> ${brandName}\n📦 <b>Package:</b> ${planLabel}\n🆔 <b>Order ID:</b> <code>${orderId}</code>\n\n🔑 <b>Credentials:</b>\n<code>${credentials}</code>\n\n<i>👆 Tap the box to copy. Thank you for choosing IPDokan!</i>`,
  orderPaidWaiting: (orderId, brandName, planLabel) => `✅ <b>Payment received successfully!</b>\n\n🆔 <b>Order:</b> <code>${orderId}</code>\n📦 <b>Package:</b> ${brandName} - ${planLabel}\n\nOur team will send your proxy credentials to this chat shortly. Please wait.`,
  outOfStockPaid: (orderId) => `⚠️ <b>Important Order Notice (#${orderId})</b>\n\nYour payment was received successfully, but instant stock for this package has just run out.\n\n🔔 Our admin has been notified automatically. A proxy will be assigned to your account shortly.\n\nFor assistance, contact us: /support`,
  noOrders: '📭 You have not placed any orders yet. Click "🛒 Buy Proxy" to get started!',
  myOrdersHeader: "📦 <b>Your Recent Orders:</b>\n",
  userOrdersCleared: (count) => `🗑️ <b>${count}</b> unpaid order${count === 1 ? " has" : "s have"} been removed from your cart.`,
  noPendingOrders: "ℹ️ There are no pending or unpaid orders in your cart.",
  orderCancelUnavailable: "⚠️ This order can no longer be cancelled. Contact support if you need help after payment.",
  orderItem: (order, brandName, planLabel) => `━━━━━━━━━━━━━━━━━━\n🆔 <b>Order:</b> <code>${order.orderId}</code>\n🏷 <b>Package:</b> ${brandName} - ${planLabel}\n💰 <b>Amount:</b> ${order.amount} ${order.currency}\n📊 <b>Status:</b> ${formatStatus(order.status)}\n📅 <b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}\n${order.deliveredCredentials ? `🔑 <b>Credentials:</b>\n<code>${order.deliveredCredentials}</code>\n` : ""}`,
  support: (contact = "@ipdokan") => `💬 <b>IPDokan Help & Customer Support</b>\n\nContact us if you have trouble using your proxy or need payment information:\n\n👉 Telegram Support: ${contact}\n🌐 Website: https://ipdokan.com\n\nWhen contacting us, please include your <b>Order ID</b>.`,
  adminStats: (stats) => `📊 <b>IPDokan Sales & Stock Summary</b>\n\n💰 <b>Today's Revenue:</b> ${stats.todayRevenue} ${stats.currency}\n📦 <b>Today's Orders:</b> ${stats.todayOrders}\n\n📈 <b>Last 7 Days Revenue:</b> ${stats.weekRevenue} ${stats.currency}\n📦 <b>Last 7 Days Orders:</b> ${stats.weekOrders}\n\n💎 <b>Total Lifetime Revenue:</b> ${stats.totalRevenue} ${stats.currency}\n📦 <b>Total Orders:</b> ${stats.totalOrders}\n👥 <b>Total Customers:</b> ${stats.totalUsers}\n\n⚠️ <b>Low Stock Alerts:</b> ${stats.lowStockCount} packages need restocking`,
  adminOnly: "⛔ This command is available to administrators only.",
};

function formatStatus(status) {
  switch (status) {
    case "delivered": return "✅ Delivered";
    case "completed": return "✅ Completed";
    case "paid":
    case "processing": return "🟢 Paid (Processing)";
    case "stock_pending": return "⏳ Provisioning Stock";
    case "pending": return "🕒 Awaiting Payment";
    case "failed": return "❌ Failed";
    case "cancelled": return "🚫 Cancelled";
    default: return status;
  }
}
