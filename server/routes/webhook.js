const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Order = require("../../models/Order");
const Brand = require("../../models/Brand");
const Plan = require("../../models/Plan");
const User = require("../../models/User");
const paymentService = require("../../services/payment");
const stockService = require("../../services/stockService");
const notifyAdminService = require("../../services/notifyAdmin");
const strings = require("../../bot/config/strings");
const { bot } = require("../../bot/index");

/**
 * WooCommerce Webhook Endpoint
 * Topic: order.updated, order.created
 * URL: /webhook/woocommerce
 */
router.post("/webhook/woocommerce", async (req, res) => {
  const wooOrder = req.body;
  const topic = req.headers["x-wc-webhook-topic"] || "";
  console.log(
    `🔔 [WooCommerce Webhook] Event: ${topic}, Order #${wooOrder?.id}, Status: ${wooOrder?.status}`,
  );

  if (!wooOrder || !wooOrder.id) {
    return res.status(400).json({ status: "INVALID_PAYLOAD" });
  }

  // Acknowledge immediately to avoid WooCommerce webhook timeouts
  res.status(200).json({ received: true });

  // Verify HMAC signature if secret is configured
  const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  const signature = req.headers["x-wc-webhook-signature"];
  if (webhookSecret && signature) {
    try {
      const computedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(req.body))
        .digest("base64");
      if (computedSig !== signature) {
        console.warn(
          "⚠️ [WooCommerce Webhook] Signature mismatch, proceeding cautiously.",
        );
      }
    } catch (e) {
      console.error("Signature verification error:", e.message);
    }
  }

  const paidStatuses = ["processing", "completed"];
  if (!paidStatuses.includes(wooOrder.status)) {
    // Keep a bot-created unpaid order in sync if it is cancelled on the website.
    // Never overwrite an already paid/delivered record from a non-paid event.
    if (["cancelled", "failed"].includes(wooOrder.status)) {
      await Order.findOneAndUpdate(
        {
          wooOrderId: String(wooOrder.id),
          status: { $in: ["pending", "failed", "cancelled"] },
        },
        { $set: { status: wooOrder.status } },
      );
    }
    console.log(
      `ℹ️ [WooCommerce Webhook] Order #${wooOrder.id} status is "${wooOrder.status}". No action needed.`,
    );
    return;
  }

  try {
    // 1. Locate matching Order in MongoDB
    let order = await Order.findOne({ wooOrderId: String(wooOrder.id) });

    // Fallback: check telegramId in metadata
    let telegramId = order?.telegramId;
    let telegramUsername = order?.telegramUsername;

    if (!order) {
      const tgMeta = wooOrder.meta_data?.find((m) => m.key === "_telegram_id");
      const tgUserMeta = wooOrder.meta_data?.find(
        (m) => m.key === "_telegram_username",
      );
      if (tgMeta?.value) {
        telegramId = parseInt(tgMeta.value, 10);
        telegramUsername = tgUserMeta?.value || "";

        const lineItem = wooOrder.line_items?.[0] || {};
        order = await Order.create({
          orderId: `ORD-WOO-${wooOrder.id}`,
          wooOrderId: String(wooOrder.id),
          wooProductId: lineItem.product_id || null,
          wooVariationId: lineItem.variation_id || null,
          productName: lineItem.name || "Proxy",
          variationName: lineItem.name || "",
          telegramId,
          telegramUsername,
          amount: parseFloat(wooOrder.total) || 0,
          currency: wooOrder.currency || "BDT",
          status: "paid",
        });
      }
    }

    if (!order) {
      console.log(
        `ℹ️ [WooCommerce Webhook] Order #${wooOrder.id} has no associated Telegram ID.`,
      );
      return;
    }

    // Check if already delivered
    if (order.status === "delivered") {
      console.log(
        `ℹ️ [WooCommerce Webhook] Order #${wooOrder.id} already delivered.`,
      );
      return;
    }

    // 2. Mark order as paid
    order.status = "paid";
    order.gatewayResponse = wooOrder;
    await order.save();

    // 3. Atomically check and assign proxy credentials from Stock collection
    const claimedStock = await stockService.assignStockToOrder(order);

    const productName =
      order.productName || wooOrder.line_items?.[0]?.name || "Proxy";
    const variationName = order.variationName || "";

    if (claimedStock) {
      // Stock available -> deliver immediately
      order.status = "delivered";
      order.deliveredStockId = claimedStock._id;
      order.deliveredCredentials = claimedStock.credentials;
      order.deliveredAt = new Date();
      await order.save();

      // Update user statistics
      if (telegramId) {
        await User.findOneAndUpdate(
          { telegramId },
          {
            $inc: { totalOrders: 1, totalSpent: order.amount },
            $set: { lastActiveAt: new Date() },
          },
        );

        // Send credentials directly to user's Telegram chat
        try {
          const deliveryMessage = strings.deliverySuccess(
            productName,
            variationName,
            claimedStock.credentials,
            order.orderId,
          );
          await bot.telegram.sendMessage(telegramId, deliveryMessage, {
            parse_mode: "HTML",
          });
          console.log(
            `✅ [WooCommerce Delivery] Sent credentials to Telegram user ${telegramId} for order #${wooOrder.id}`,
          );
        } catch (tgErr) {
          console.error(
            `❌ [WooCommerce Delivery] Telegram send error to ${telegramId}:`,
            tgErr.message,
          );
        }
      }

      // Notify admin
      await notifyAdminService.notifyOrderDelivered(
        order,
        { name: productName },
        { label: variationName },
      );
    } else {
      // Out of stock in automated pool -> notify customer politely & alert admin
      order.status = "stock_pending";
      await order.save();

      console.warn(
        `⚠️ [WooCommerce Fulfillment] No pre-loaded stock for Order #${wooOrder.id}.`,
      );

      if (telegramId) {
        try {
          const waitMsg = strings.orderPaidWaiting(
            order.orderId,
            productName,
            variationName,
          );
          await bot.telegram.sendMessage(telegramId, waitMsg, {
            parse_mode: "HTML",
          });
        } catch (tgErr) {
          console.error("Telegram notification error:", tgErr.message);
        }
      }

      // Alert Admin on Telegram
      await notifyAdminService.notifyWooOrderPaid(wooOrder, order);
    }
  } catch (err) {
    console.error("❌ [WooCommerce Webhook] Error processing order:", err);
  }
});

/**
 * SSLCommerz IPN (Instant Payment Notification) Webhook
 * Handles server-to-server payment confirmation and instant fulfillment.
 */
router.post("/webhook/payment-ipn", async (req, res) => {
  console.log("🔔 [IPN Webhook] Received payment notification:", req.body);
  const payload = req.body;

  try {
    const verification = await paymentService.verifyPayment(payload);

    if (!verification.verified) {
      console.error(
        "❌ [IPN Webhook] Payment verification failed:",
        verification.error,
      );
      return res
        .status(400)
        .json({ status: "FAILED", message: verification.error });
    }

    const tranId = verification.tranId || payload.tran_id;
    if (!tranId) {
      return res
        .status(400)
        .json({ status: "FAILED", message: "Missing transaction ID" });
    }

    const order = await Order.findOne({ gatewayTransactionId: tranId });
    if (!order) {
      console.error(
        `❌ [IPN Webhook] Order with transaction ID ${tranId} not found.`,
      );
      return res
        .status(404)
        .json({ status: "FAILED", message: "Order not found" });
    }

    if (order.status === "delivered" || order.status === "paid") {
      console.log(
        `ℹ️ [IPN Webhook] Order ${order.orderId} already ${order.status}.`,
      );
      return res.status(200).json({ status: "ALREADY_PROCESSED" });
    }

    order.status = "paid";
    order.gatewayResponse = verification.raw || payload;
    await order.save();

    const [brand, plan] = await Promise.all([
      Brand.findById(order.brandId),
      Plan.findById(order.planId),
    ]);

    const brandName = brand?.name || order.productName || "Proxy Provider";
    const planLabel = plan?.label || order.variationName || "Proxy Plan";

    const claimedStock = await stockService.assignStockToOrder(order);

    if (claimedStock) {
      order.status = "delivered";
      order.deliveredStockId = claimedStock._id;
      order.deliveredCredentials = claimedStock.credentials;
      order.deliveredAt = new Date();
      await order.save();

      await User.findOneAndUpdate(
        { telegramId: order.telegramId },
        {
          $inc: { totalOrders: 1, totalSpent: order.amount },
          $set: { lastActiveAt: new Date() },
        },
      );

      try {
        const deliveryMessage = strings.deliverySuccess(
          brandName,
          planLabel,
          claimedStock.credentials,
          order.orderId,
        );
        await bot.telegram.sendMessage(order.telegramId, deliveryMessage, {
          parse_mode: "HTML",
        });
      } catch (tgErr) {
        console.error(
          `❌ [Fulfillment] Failed to send Telegram message:`,
          tgErr.message,
        );
      }

      await notifyAdminService.notifyOrderDelivered(order, brand, plan);
      return res
        .status(200)
        .json({ status: "DELIVERED", orderId: order.orderId });
    } else {
      order.status = "stock_pending";
      await order.save();

      try {
        const outOfStockMsg = strings.outOfStockPaid(order.orderId);
        await bot.telegram.sendMessage(order.telegramId, outOfStockMsg, {
          parse_mode: "HTML",
        });
      } catch (tgErr) {
        console.error(`❌ [Fulfillment] Telegram send error:`, tgErr.message);
      }

      await notifyAdminService.notifyOutOfStock(order, brand, plan);
      return res
        .status(200)
        .json({ status: "STOCK_PENDING", orderId: order.orderId });
    }
  } catch (err) {
    console.error("❌ [IPN Webhook] Unexpected error:", err);
    return res.status(500).json({ status: "ERROR", message: err.message });
  }
});

// Helper to render return page
function renderReturnPage({ title, statusText, subText, isSuccess, orderId }) {
  const primaryColor = isSuccess ? "#10B981" : "#EF4444";
  const icon = isSuccess ? "✅" : "❌";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; max-width: 440px; width: 100%; padding: 32px 24px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .icon { font-size: 54px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin-bottom: 10px; color: ${primaryColor}; }
    p { font-size: 15px; color: #94a3b8; line-height: 1.5; margin-bottom: 20px; }
    .badge { display: inline-block; background: #0f172a; border: 1px solid #334155; padding: 6px 14px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #cbd5e1; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .btn:hover { background-color: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${statusText}</h1>
    <p>${subText}</p>
    ${orderId ? `<div class="badge">Order ID: ${orderId}</div><br/>` : ""}
    <a href="https://t.me" class="btn">Return to Telegram</a>
  </div>
</body>
</html>
  `;
}

// Payment Redirection Routes
router.all("/payment/success", (req, res) => {
  const orderId = req.query.order_id || req.body?.value_a || "";
  res.send(
    renderReturnPage({
      title: "Payment Successful",
      statusText: "Payment Received Successfully!",
      subText:
        "Your payment was confirmed. Your proxy credentials have been delivered directly to your Telegram chat.",
      isSuccess: true,
      orderId,
    }),
  );
});

router.all("/payment/fail", (req, res) => {
  const orderId = req.query.order_id || req.body?.value_a || "";
  res.send(
    renderReturnPage({
      title: "Payment Failed",
      statusText: "Payment Was Not Completed",
      subText:
        "Your transaction could not be processed. You can retry anytime via Telegram.",
      isSuccess: false,
      orderId,
    }),
  );
});

router.all("/payment/cancel", (req, res) => {
  const orderId = req.query.order_id || req.body?.value_a || "";
  res.send(
    renderReturnPage({
      title: "Payment Cancelled",
      statusText: "Payment Cancelled",
      subText:
        "You cancelled the checkout session. Feel free to resume when you are ready.",
      isSuccess: false,
      orderId,
    }),
  );
});

module.exports = router;
