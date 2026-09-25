const { Markup } = require("telegraf");
const strings = require("./config/strings");

/**
 * Main persistent reply keyboard
 */
function mainMenuKeyboard() {
  return Markup.keyboard([
    [strings.buyProxyButton, strings.myOrdersButton],
    [strings.supportButton],
  ]).resize();
}

/**
 * Inline keyboard displaying all dynamic categories from WooCommerce
 * @param {Array} categories - Array of category objects { id, name, count, emoji }
 */
function categoriesKeyboard(categories) {
  const buttons = categories.map((cat) =>
    Markup.button.callback(
      `${cat.emoji} ${cat.name} (${cat.count})`,
      `cat_${cat.id}`,
    ),
  );

  // Group 1 or 2 per row
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  // Refresh button
  rows.push([
    Markup.button.callback("🔄 Refresh Categories", "refresh_categories"),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Inline keyboard for Products under a selected category
 * @param {Array} products - WooCommerce products
 * @param {number|string} categoryId
 */
function productsKeyboard(products, categoryId) {
  const buttons = products.map((prod) =>
    Markup.button.callback(`📦 ${prod.name}`, `prod_${prod.id}_${categoryId}`),
  );

  // Group 2 per row
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  // Back button to category selection
  rows.push([
    Markup.button.callback("⬅️ Back to Categories", "back_to_cats"),
    Markup.button.callback("🔄 Refresh", `cat_${categoryId}`),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Inline keyboard for Plan / Variation selection
 * @param {Array} variations - WooCommerce variations
 * @param {number|string} productId
 * @param {number|string} categoryId
 */
function variationsKeyboard(variations, productId, categoryId) {
  const rows = variations.map((v) => {
    if (v.inStock) {
      const stockBadge = v.stockQuantity ? `(${v.stockQuantity} left)` : "";
      return [
        Markup.button.callback(
          `⚡ ${v.name} — ${v.price} BDT ${stockBadge}`,
          `var_${productId}_${v.id}`,
        ),
      ];
    } else {
      return [
        Markup.button.callback(
          `❌ ${v.name} — ${v.price} BDT [Out of Stock]`,
          `outofstock_${v.id}`,
        ),
      ];
    }
  });

  // Back to product list under this category
  rows.push([
    Markup.button.callback("⬅️ Back to Products", `cat_${categoryId}`),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Inline keyboard for Order payment checkout
 * @param {string} checkoutUrl - WooCommerce checkout URL
 * @param {string} orderId
 * @param {number|string} amount
 * @param {string} currency
 */
function orderPaymentKeyboard(checkoutUrl, orderId, amount, currency) {
  return Markup.inlineKeyboard([
    [Markup.button.url(strings.payButtonText(amount, currency), checkoutUrl)],
    [Markup.button.callback("❌ Cancel Order", `cancel_order_${orderId}`)],
  ]);
}

/**
 * Inline keyboard for user order history management
 * Only unpaid orders can be removed. Paid orders remain as a receipt/audit trail.
 * @param {number} pendingCount
 */
function userOrdersKeyboard(pendingCount = 0) {
  const rows = [];
  if (pendingCount > 0) {
    rows.push([
      Markup.button.callback(
        `🗑️ Remove Unpaid Cart (${pendingCount})`,
        "user_clear_pending",
      ),
    ]);
  }
  rows.push([
    Markup.button.callback("🔄 Refresh Orders", "user_refresh_orders"),
    Markup.button.callback("🛒 Buy Proxy", "back_to_cats"),
  ]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  mainMenuKeyboard,
  categoriesKeyboard,
  productsKeyboard,
  variationsKeyboard,
  orderPaymentKeyboard,
  userOrdersKeyboard,
};
