const { Markup } = require("telegraf");
const Brand = require("../../models/Brand");
const Plan = require("../../models/Plan");
const Order = require("../../models/Order");
const User = require("../../models/User");
const stockService = require("../../services/stockService");
const strings = require("../config/strings");

// In-memory wizard state for multi-step /addstock flow keyed by Telegram ID
const addStockSessions = new Map();

function isAdmin(telegramId) {
  const rawAdminIds = process.env.ADMIN_IDS || "";
  const adminIds = rawAdminIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(String(telegramId));
}

/**
 * Register all admin bot handlers and conversational flows
 * @param {import('telegraf').Telegraf} bot
 */
function registerAdminHandlers(bot) {
  // Middleware to restrict admin commands
  const requireAdmin = async (ctx, next) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.reply(strings.adminOnly);
    }
    return next();
  };

  // /stats command
  bot.command("stats", requireAdmin, async (ctx) => {
    try {
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [todayOrders, weekOrders, totalOrders, totalUsers, stockSummary] =
        await Promise.all([
          Order.find({
            status: { $in: ["paid", "delivered"] },
            createdAt: { $gte: startOfToday },
          }),
          Order.find({
            status: { $in: ["paid", "delivered"] },
            createdAt: { $gte: startOfWeek },
          }),
          Order.find({
            status: { $in: ["paid", "delivered"] },
          }),
          User.countDocuments(),
          stockService.getStockSummary(5),
        ]);

      const todayRevenue = todayOrders.reduce(
        (sum, o) => sum + (o.amount || 0),
        0,
      );
      const weekRevenue = weekOrders.reduce(
        (sum, o) => sum + (o.amount || 0),
        0,
      );
      const totalRevenue = totalOrders.reduce(
        (sum, o) => sum + (o.amount || 0),
        0,
      );
      const currency = totalOrders[0]?.currency || "BDT";

      const stats = {
        todayRevenue: todayRevenue.toFixed(2),
        todayOrders: todayOrders.length,
        weekRevenue: weekRevenue.toFixed(2),
        weekOrders: weekOrders.length,
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders: totalOrders.length,
        totalUsers,
        lowStockCount: stockSummary.lowStockAlerts.length,
        currency,
      };

      await ctx.reply(strings.adminStats(stats), { parse_mode: "HTML" });
    } catch (err) {
      console.error("[AdminStats] Error:", err);
      await ctx.reply(`❌ Error generating stats: ${err.message}`);
    }
  });

  // /cancel command for wizard
  bot.command("cancel", requireAdmin, async (ctx) => {
    if (addStockSessions.has(ctx.from.id)) {
      addStockSessions.delete(ctx.from.id);
      return ctx.reply("🛑 Stock upload cancelled.");
    }
    return ctx.reply("No active operation to cancel.");
  });

  // /clearorders command
  bot.command("clearorders", requireAdmin, async (ctx) => {
    const total = await Order.countDocuments();
    return ctx.reply(
      `⚠️ <b>[Admin Action] Clear All Orders</b>\n\n` +
        `Are you sure you want to permanently delete all <b>${total}</b> orders from the database?\n\n` +
        `<i>This action cannot be undone!</i>`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🗑️ Yes, Delete All Orders",
              "admin_confirm_clear_orders",
            ),
          ],
          [Markup.button.callback("❌ Cancel", "admin_cancel_clear_orders")],
        ]),
      },
    );
  });

  bot.action("admin_cancel_clear_orders", requireAdmin, async (ctx) => {
    await ctx.answerCbQuery("Cancelled");
    return ctx.editMessageText("🛑 Clear orders operation cancelled.");
  });

  bot.action("admin_confirm_clear_orders", requireAdmin, async (ctx) => {
    await ctx.answerCbQuery("Clearing orders...");
    try {
      const result = await Order.deleteMany({});
      return ctx.editMessageText(
        `✅ <b>Orders Cleared!</b>\n\nSuccessfully deleted <code>${result.deletedCount}</code> orders from the database.`,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      return ctx.editMessageText(`❌ Error deleting orders: ${err.message}`);
    }
  });

  // /addstock command - Step 1: select brand
  bot.command("addstock", requireAdmin, async (ctx) => {
    const brands = await Brand.find().sort({ displayOrder: 1, name: 1 });
    if (brands.length === 0) {
      return ctx.reply(
        "⚠️ No brands found. Please create brands via admin panel first.",
      );
    }

    addStockSessions.set(ctx.from.id, { step: "SELECT_BRAND" });

    const buttons = brands.map((b) => [
      Markup.button.callback(
        `${b.emoji} ${b.name}`,
        `admin_stock_brand_${b._id}`,
      ),
    ]);
    buttons.push([Markup.button.callback("❌ Cancel", "admin_stock_cancel")]);

    return ctx.reply(
      "📦 <b>[Add Stock Wizard]</b>\n\nSelect the brand you want to add stock for:",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard(buttons),
      },
    );
  });

  // Callback: cancel wizard
  bot.action("admin_stock_cancel", requireAdmin, async (ctx) => {
    await ctx.answerCbQuery("Cancelled");
    addStockSessions.delete(ctx.from.id);
    return ctx.editMessageText("🛑 Stock upload operation cancelled.");
  });

  // Step 2: brand selected callback -> select plan
  bot.action(/^admin_stock_brand_(.+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const brandId = ctx.match[1];
    const brand = await Brand.findById(brandId);
    if (!brand) return ctx.editMessageText("❌ Brand not found.");

    const plans = await Plan.find({ brandId }).sort({
      displayOrder: 1,
      price: 1,
    });
    if (plans.length === 0) {
      return ctx.editMessageText(
        `⚠️ No plans found for <b>${brand.name}</b>. Please create a plan first.`,
        { parse_mode: "HTML" },
      );
    }

    addStockSessions.set(ctx.from.id, {
      step: "SELECT_PLAN",
      brandId: brand._id,
      brandName: brand.name,
    });

    const buttons = plans.map((p) => [
      Markup.button.callback(
        `📦 ${p.label} (${p.price} ${p.currency})`,
        `admin_stock_plan_${p._id}`,
      ),
    ]);
    buttons.push([Markup.button.callback("❌ Cancel", "admin_stock_cancel")]);

    return ctx.editMessageText(
      `📦 <b>[Add Stock Wizard]</b>\n\nBrand: <b>${brand.name}</b>\n\nNow select the plan:`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard(buttons),
      },
    );
  });

  // Step 3: plan selected callback -> prompt for text credentials
  bot.action(/^admin_stock_plan_(.+)$/, requireAdmin, async (ctx) => {
    await ctx.answerCbQuery();
    const planId = ctx.match[1];
    const session = addStockSessions.get(ctx.from.id);

    if (!session || session.step !== "SELECT_PLAN") {
      return ctx.editMessageText(
        "⚠️ Session expired. Please type /addstock again.",
      );
    }

    const plan = await Plan.findById(planId);
    if (!plan) return ctx.editMessageText("❌ Plan not found.");

    session.step = "AWAITING_CREDENTIALS";
    session.planId = plan._id;
    session.planLabel = plan.label;
    addStockSessions.set(ctx.from.id, session);

    return ctx.editMessageText(
      `📥 <b>Ready to Receive Stock</b>\n\n` +
        `🏷 <b>Brand:</b> ${session.brandName}\n` +
        `📦 <b>Plan:</b> ${plan.label}\n\n` +
        `Please <b>reply to this message</b> (or send in chat) the proxy credentials.\n` +
        `You can paste multiple lines (one proxy per line, e.g. <code>ip:port:user:pass</code>).\n\n` +
        `<i>Type /cancel anytime to abort.</i>`,
      { parse_mode: "HTML" },
    );
  });

  // Step 4: Admin sends text message with credentials
  bot.on("text", async (ctx, next) => {
    if (!isAdmin(ctx.from.id)) {
      return next();
    }

    const session = addStockSessions.get(ctx.from.id);
    if (!session || session.step !== "AWAITING_CREDENTIALS") {
      return next();
    }

    const text = ctx.message.text.trim();
    if (text.startsWith("/")) {
      return next(); // Allow other commands like /cancel
    }

    try {
      const result = await stockService.bulkAddStock(
        session.brandId,
        session.planId,
        text,
        `Added via Telegram /addstock by admin ${ctx.from.id}`,
      );

      const availableCount = await stockService.getAvailableStockCount(
        session.brandId,
        session.planId,
      );

      addStockSessions.delete(ctx.from.id);

      return ctx.reply(
        `✅ <b>Stock Added Successfully!</b>\n\n` +
          `🏷 <b>Brand:</b> ${session.brandName}\n` +
          `📦 <b>Plan:</b> ${session.planLabel}\n` +
          `➕ <b>Added:</b> <code>${result.addedCount}</code> credentials\n` +
          `📦 <b>Total Available Now:</b> <code>${availableCount}</code> credentials`,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      console.error("[AddStock] Error:", err);
      return ctx.reply(`❌ Error adding stock: ${err.message}`);
    }
  });
}

module.exports = {
  registerAdminHandlers,
  isAdmin,
};
