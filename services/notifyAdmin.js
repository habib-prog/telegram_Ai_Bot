/**
 * Admin Notification Service
 * Sends direct Telegram messages to admin IDs defined in ADMIN_IDS
 */

let botInstance = null;

function setBotInstance(bot) {
  botInstance = bot;
}

function getAdminIds() {
  const raw = process.env.ADMIN_IDS || "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Sends a message to all configured admin chat IDs.
 * @param {string} message - Markdown or text message to send
 * @param {Object} [extra] - Telegraf send options (e.g. parse_mode)
 */
async function notifyAdmins(message, extra = { parse_mode: "HTML" }) {
  const adminIds = getAdminIds();
  if (!adminIds.length) {
    console.warn(
      "[NotifyAdmin] No ADMIN_IDS configured in environment variables.",
    );
    return;
  }

  if (!botInstance) {
    console.warn(
      "[NotifyAdmin] Bot instance not registered yet. Unable to send admin alert.",
    );
    return;
  }

  const sendPromises = adminIds.map(async (adminId) => {
    try {
      await botInstance.telegram.sendMessage(adminId, message, extra);
    } catch (err) {
      console.error(
        `[NotifyAdmin] Failed to deliver alert to admin ${adminId}:`,
        err.message,
      );
    }
  });

  await Promise.allSettled(sendPromises);
}

/**
 * Specifically notifies admins when a paid order cannot be fulfilled due to empty stock.
 */
async function notifyOutOfStock(order, brand, plan) {
  const message = `
⚠️ <b>URGENT: OUT OF STOCK ALERT!</b> ⚠️

A customer has paid, but <b>no proxy stock is available</b> for automated delivery!

📦 <b>Order ID:</b> <code>${order.orderId}</code>
👤 <b>Customer ID:</b> <code>${order.telegramId}</code> (${order.telegramUsername ? "@" + order.telegramUsername : "No username"})
🏷 <b>Brand:</b> ${brand?.name || order.productName || "Unknown"}
📋 <b>Plan:</b> ${plan?.label || order.variationName || "Unknown"}
💰 <b>Amount Paid:</b> ${order.amount} ${order.currency || "BDT"}

Please replenish stock via the Admin Dashboard or <code>/addstock</code> command and manually deliver to the customer!
`.trim();

  await notifyAdmins(message);
}

/**
 * Notifies admins on successful order fulfillment.
 */
async function notifyOrderDelivered(order, brand, plan) {
  const message = `
✅ <b>New Proxy Sold & Delivered!</b>

📦 <b>Order:</b> <code>${order.orderId}</code>
👤 <b>Customer:</b> <code>${order.telegramId}</code> (${order.telegramUsername ? "@" + order.telegramUsername : "N/A"})
🏷 <b>Package:</b> ${brand?.name || order.productName || ""} - ${plan?.label || order.variationName || ""}
💰 <b>Earned:</b> ${order.amount} ${order.currency || "BDT"}
`.trim();

  await notifyAdmins(message);
}

/**
 * Notifies admins when an order is paid on WooCommerce.
 */
async function notifyWooOrderPaid(wooOrder, localOrder) {
  const lineItem = wooOrder.line_items?.[0] || {};
  const message = `
🔔 <b>New Paid Order on ipdokan.com!</b>

🆔 <b>WooCommerce Order:</b> #${wooOrder.id}
👤 <b>Customer:</b> ${localOrder?.telegramUsername ? "@" + localOrder.telegramUsername : "ID: " + (localOrder?.telegramId || "Direct Website")}
🏷 <b>Product:</b> ${lineItem.name || localOrder?.productName || "Proxy"}
💰 <b>Amount:</b> ${wooOrder.total} ${wooOrder.currency || "BDT"}
📊 <b>Status:</b> ${wooOrder.status}
`.trim();

  await notifyAdmins(message);
}

module.exports = {
  setBotInstance,
  notifyAdmins,
  notifyOutOfStock,
  notifyOrderDelivered,
  notifyWooOrderPaid,
  getAdminIds,
};
