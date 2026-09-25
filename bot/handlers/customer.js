const Order = require("../../models/Order");
const User = require("../../models/User");
const strings = require("../config/strings");
const keyboards = require("../keyboards");
const woocommerce = require("../../services/woocommerce");

/**
 * Registers or updates user activity in database
 */
async function trackUser(from) {
  try {
    await User.findOneAndUpdate(
      { telegramId: from.id },
      {
        $set: {
          username: from.username || "",
          firstName: from.first_name || "",
          lastActiveAt: new Date(),
        },
        $setOnInsert: {
          firstSeenAt: new Date(),
          totalOrders: 0,
          totalSpent: 0,
        },
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.error("[TrackUser] Error recording user:", err.message);
  }
}

/**
 * Register all customer bot handlers
 * @param {import('telegraf').Telegraf} bot
 */
function registerCustomerHandlers(bot) {
  // /start command
  bot.start(async (ctx) => {
    await trackUser(ctx.from);
    await ctx.reply(strings.welcome(ctx.from.first_name), {
      parse_mode: "HTML",
      ...keyboards.mainMenuKeyboard(),
    });
  });

  // Main menu button
  bot.hears(strings.mainMenuButton, async (ctx) => {
    await trackUser(ctx.from);
    await ctx.reply(strings.welcome(ctx.from.first_name), {
      parse_mode: "HTML",
      ...keyboards.mainMenuKeyboard(),
    });
  });

  // Step 1: User taps "Buy Proxy" or /buy -> Fetch & display ALL categories from WooCommerce
  bot.hears(strings.buyProxyButton, showAllCategories);
  bot.command("buy", showAllCategories);

  async function showAllCategories(ctx) {
    await trackUser(ctx.from);
    try {
      const categories = await woocommerce.getCategories();
      if (!categories || categories.length === 0) {
        return ctx.reply(
          "⚠️ No categories were found. Please try again in a moment.",
        );
      }
      return ctx.reply(strings.selectCategory, {
        parse_mode: "HTML",
        ...keyboards.categoriesKeyboard(categories),
      });
    } catch (err) {
      console.error("[Bot Categories Error]:", err.message);
      return ctx.reply(
        "❌ Unable to load categories. Please try again.",
      );
    }
  }

  // Handle "Back to Categories" or "Refresh Categories"
  bot.action(["back_to_cats", "refresh_categories"], async (ctx) => {
    await ctx.answerCbQuery("Loading categories...");
    try {
      const force = ctx.match === "refresh_categories";
      const categories = await woocommerce.getCategories(force);
      return ctx.editMessageText(strings.selectCategory, {
        parse_mode: "HTML",
        ...keyboards.categoriesKeyboard(categories),
      });
    } catch (err) {
      return ctx.editMessageText("❌ Failed to load categories.");
    }
  });

  // Step 2: User clicks a Category: cat_<categoryId> -> Fetch & display Products under that Category
  bot.action(/^cat_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery("Loading products...");
    const categoryId = ctx.match[1];

    try {
      const [categories, products] = await Promise.all([
        woocommerce.getCategories(),
        woocommerce.getProductsByCategory(categoryId),
      ]);

      const currentCat = categories.find(
        (c) => String(c.id) === String(categoryId),
      );
      const catName = currentCat
        ? `${currentCat.emoji} ${currentCat.name}`
        : "Category";

      if (!products || products.length === 0) {
        return ctx.editMessageText(
          `⚠️ There are currently no products in <b>${catName}</b>.`,
          {
            parse_mode: "HTML",
            ...keyboards.productsKeyboard([], categoryId),
          },
        );
      }

      return ctx.editMessageText(strings.selectProduct(catName), {
        parse_mode: "HTML",
        ...keyboards.productsKeyboard(products, categoryId),
      });
    } catch (err) {
      console.error("[Bot Category Products Error]:", err.message);
      return ctx.editMessageText(
        "❌ Unable to load products. Please try again.",
      );
    }
  });

  // Step 3: User clicks a Product: prod_<productId>_<categoryId> -> Show Variations / Packages
  bot.action(/^prod_(\d+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery("Loading packages...");
    const productId = ctx.match[1];
    const categoryId = ctx.match[2];

    try {
      const [product, variations] = await Promise.all([
        woocommerce.getProduct(productId),
        woocommerce.getProductVariations(productId),
      ]);

      if (!variations || variations.length === 0) {
        // Simple product or no variations
        const price = parseFloat(product.price) || 0;
        const timestamp = Date.now().toString().slice(-6);
        const orderId = `ORD-${timestamp}-${Math.floor(1000 + Math.random() * 9000)}`;

        const wooResult = await woocommerce.createOrder({
          telegramId: ctx.from.id,
          telegramUsername: ctx.from.username || "",
          firstName: ctx.from.first_name || "",
          productId,
          quantity: 1,
          note: `Order from Telegram: @${ctx.from.username || ctx.from.id}`,
        });

        await Order.create({
          orderId,
          wooOrderId: String(wooResult.id),
          wooProductId: parseInt(productId, 10),
          productName: product.name,
          telegramId: ctx.from.id,
          telegramUsername: ctx.from.username || "",
          telegramFirstName: ctx.from.first_name || "",
          amount: price,
          currency: "BDT",
          gatewayRedirectUrl: wooResult.paymentUrl,
          status: "pending",
        });

        const summaryText = strings.orderSummary(
          product.name,
          "Standard",
          price,
          "BDT",
          orderId,
        );
        return ctx.editMessageText(summaryText, {
          parse_mode: "HTML",
          ...keyboards.orderPaymentKeyboard(
            wooResult.paymentUrl,
            orderId,
            price,
            "BDT",
          ),
        });
      }

      return ctx.editMessageText(strings.selectPlan(product.name), {
        parse_mode: "HTML",
        ...keyboards.variationsKeyboard(variations, productId, categoryId),
      });
    } catch (err) {
      console.error("[Bot Product Details Error]:", err.message);
      return ctx.editMessageText(
        "❌ Unable to load packages. Please try again.",
      );
    }
  });

  // Step 4: Out of stock click
  bot.action(/^outofstock_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery("⚠️ This package is currently out of stock!", {
      show_alert: true,
    });
  });

  // Step 5: User clicks a Variation / Package: var_<productId>_<variationId> -> Checkout
  bot.action(/^var_(\d+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery("Generating payment link...");
    const productId = ctx.match[1];
    const variationId = ctx.match[2];

    try {
      const [product, variations] = await Promise.all([
        woocommerce.getProduct(productId),
        woocommerce.getProductVariations(productId),
      ]);

      const selectedVar = variations.find(
        (v) => String(v.id) === String(variationId),
      );
      if (!selectedVar) {
        return ctx.editMessageText("❌ The selected package could not be found.");
      }

      if (!selectedVar.inStock) {
        return ctx.editMessageText(strings.outOfStockAlert);
      }

      const timestamp = Date.now().toString().slice(-6);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderId = `ORD-${timestamp}-${randomSuffix}`;
      const price = parseFloat(selectedVar.price) || 0;

      // Create Order in WooCommerce
      const wooResult = await woocommerce.createOrder({
        telegramId: ctx.from.id,
        telegramUsername: ctx.from.username || "",
        firstName: ctx.from.first_name || "",
        productId,
        variationId,
        quantity: 1,
        note: `Order from Telegram: @${ctx.from.username || ctx.from.id}`,
      });

      // Save order in local MongoDB
      await Order.create({
        orderId,
        wooOrderId: String(wooResult.id),
        wooProductId: parseInt(productId, 10),
        wooVariationId: parseInt(variationId, 10),
        productName: product.name,
        variationName: selectedVar.name,
        proxyType: product.name.toUpperCase().includes("GB") ? "gb" : "ip",
        telegramId: ctx.from.id,
        telegramUsername: ctx.from.username || "",
        telegramFirstName: ctx.from.first_name || "",
        amount: price,
        currency: "BDT",
        gatewayRedirectUrl: wooResult.paymentUrl,
        status: "pending",
      });

      const summaryText = strings.orderSummary(
        product.name,
        selectedVar.name,
        price,
        "BDT",
        orderId,
      );

      return ctx.editMessageText(summaryText, {
        parse_mode: "HTML",
        ...keyboards.orderPaymentKeyboard(
          wooResult.paymentUrl,
          orderId,
          price,
          "BDT",
        ),
      });
    } catch (err) {
      console.error("[OrderCreation Error]:", err.message);
      return ctx.editMessageText(
        `❌ Unable to create your order: ${err.message}\n\nPlease try again in a moment.`,
      );
    }
  });

  // Handle Cancel Order callback: cancel_order_<orderId>
  bot.action(/^cancel_order_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    try {
      const cancelled = await cancelPendingOrder(orderId, ctx.from.id);
      if (!cancelled) {
        await ctx.answerCbQuery(strings.orderCancelUnavailable, {
          show_alert: true,
        });
        return;
      }
      await ctx.answerCbQuery("Order cancelled");
      return ctx.editMessageText(strings.orderCancelled);
    } catch (err) {
      console.error("[Cancel Order]", err.message);
      return ctx.answerCbQuery("Unable to cancel the order. Please try again.", {
        show_alert: true,
      });
    }
  });

  // /myorders command or reply button
  bot.hears(strings.myOrdersButton, showMyOrders);
  bot.command("myorders", showMyOrders);

  async function showMyOrders(ctx) {
    await trackUser(ctx.from);
    const view = await getOrdersView(ctx.from.id);
    return ctx.reply(view.text, {
      parse_mode: "HTML",
      ...keyboards.userOrdersKeyboard(view.pendingCount),
    });
  }

  bot.action("user_refresh_orders", async (ctx) => {
    await ctx.answerCbQuery("Refreshing orders...");
    const view = await getOrdersView(ctx.from.id);
    return ctx.editMessageText(view.text, {
      parse_mode: "HTML",
      ...keyboards.userOrdersKeyboard(view.pendingCount),
    });
  });

  // Cancels the WooCommerce orders too, so unpaid carts do not remain active
  // on the website. Paid orders are intentionally never removable by a user.
  bot.action("user_clear_pending", async (ctx) => {
    try {
      const pendingOrders = await Order.find({
        telegramId: ctx.from.id,
        status: "pending",
      });
      if (!pendingOrders.length) {
        await ctx.answerCbQuery(strings.noPendingOrders, { show_alert: true });
        return;
      }

      const results = await Promise.allSettled(
        pendingOrders.map((order) => cancelPendingOrder(order.orderId, ctx.from.id)),
      );
      const cancelledCount = results.filter(
        (result) => result.status === "fulfilled" && result.value,
      ).length;

      await ctx.answerCbQuery(
        cancelledCount
          ? `${cancelledCount} order${cancelledCount === 1 ? " has" : "s have"} been cancelled`
          : "No orders could be cancelled",
        { show_alert: true },
      );
      const view = await getOrdersView(ctx.from.id);
      return ctx.editMessageText(
        cancelledCount ? `${strings.userOrdersCleared(cancelledCount)}\n\n${view.text}` : view.text,
        {
          parse_mode: "HTML",
          ...keyboards.userOrdersKeyboard(view.pendingCount),
        },
      );
    } catch (err) {
      console.error("[Clear Pending Orders]", err.message);
      return ctx.answerCbQuery("Unable to clear the cart. Please try again.", {
        show_alert: true,
      });
    }
  });

  async function getOrdersView(telegramId) {
    const orders = await Order.find({ telegramId })
      .sort({ createdAt: -1 })
      .limit(10);
    const pendingCount = await Order.countDocuments({
      telegramId,
      status: "pending",
    });

    if (orders.length === 0) {
      return { text: strings.noOrders, pendingCount };
    }

    let text = strings.myOrdersHeader;
    for (const ord of orders) {
      text += "\n" + strings.orderItem(
        ord,
        ord.productName || "Proxy",
        ord.variationName || "Package",
      );
    }
    return { text, pendingCount };
  }

  async function cancelPendingOrder(orderId, telegramId) {
    const order = await Order.findOne({ orderId, telegramId, status: "pending" });
    if (!order) return false;

    // Cancel website-side first. This prevents a stale payment URL from being used.
    if (order.wooOrderId && !order.wooOrderId.startsWith("DIRECT-")) {
      await woocommerce.cancelOrder(order.wooOrderId);
    }

    // Conditional update prevents overwriting a payment webhook that arrived meanwhile.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending" },
      { $set: { status: "cancelled" } },
      { new: true },
    );
    return Boolean(updated);
  }

  // /help or /support command or reply button
  bot.hears(strings.supportButton, showSupport);
  bot.command("help", showSupport);
  bot.command("support", showSupport);

  async function showSupport(ctx) {
    await trackUser(ctx.from);
    const supportContact = process.env.SUPPORT_CONTACT || "@ipdokan";
    return ctx.reply(strings.support(supportContact), { parse_mode: "HTML" });
  }
}

module.exports = {
  registerCustomerHandlers,
};
