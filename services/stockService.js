const Stock = require("../models/Stock");
const Brand = require("../models/Brand");
const Plan = require("../models/Plan");

/**
 * Atomically claims an unused proxy stock item for an order.
 * Ensures zero race conditions or double-allocations.
 *
 * @param {Object} order - The Order document
 * @returns {Promise<Object|null>} - The claimed Stock document or null if stock empty
 */
async function assignStockToOrder(order) {
  const query = { isUsed: false };

  if (order.wooVariationId) {
    query.wooVariationId = order.wooVariationId;
  } else if (order.wooProductId) {
    query.wooProductId = order.wooProductId;
  } else if (order.brandId && order.planId) {
    query.brandId = order.brandId;
    query.planId = order.planId;
  }

  const claimedStock = await Stock.findOneAndUpdate(
    query,
    {
      $set: {
        isUsed: true,
        assignedToTelegramId: order.telegramId,
        assignedAt: new Date(),
        orderId: order._id,
      },
    },
    {
      new: true, // returns updated doc
      sort: { createdAt: 1 }, // FIFO - allocate oldest stock first
    },
  );

  return claimedStock;
}

/**
 * Bulk adds credentials for a brand/plan or WooCommerce product/variation.
 * Accepts an array of credential strings or a newline-delimited text block.
 *
 * @param {Object} target - { brandId, planId, wooProductId, wooVariationId, productName, variationName }
 * @param {string[]|string} credentialsInput
 * @param {string} [batchNote]
 * @returns {Promise<{addedCount: number, errors: string[]}>}
 */
async function bulkAddStock(target, credentialsInput, batchNote = "") {
  let lines = [];
  if (Array.isArray(credentialsInput)) {
    lines = credentialsInput;
  } else if (typeof credentialsInput === "string") {
    lines = credentialsInput.split(/\r?\n/);
  }

  // Filter out empty lines and trim whitespace
  const cleanCredentials = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (cleanCredentials.length === 0) {
    return { addedCount: 0, errors: ["No valid credentials found in input."] };
  }

  const docs = cleanCredentials.map((cred) => ({
    wooProductId: target.wooProductId || null,
    wooVariationId: target.wooVariationId || null,
    productName: target.productName || "",
    variationName: target.variationName || "",
    brandId: target.brandId || null,
    planId: target.planId || null,
    credentials: cred,
    isUsed: false,
    batchNote:
      batchNote || `Bulk added on ${new Date().toISOString().split("T")[0]}`,
  }));

  const inserted = await Stock.insertMany(docs, { ordered: false });
  return { addedCount: inserted.length, errors: [] };
}

/**
 * Get available unused stock count for a specific target.
 */
async function getAvailableStockCount(target) {
  const query = { isUsed: false };
  if (target.wooVariationId) query.wooVariationId = target.wooVariationId;
  else if (target.wooProductId) query.wooProductId = target.wooProductId;
  else if (target.planId) query.planId = target.planId;
  return Stock.countDocuments(query);
}

/**
 * Returns comprehensive stock statistics.
 * Used for admin dashboard and low-stock alerts.
 */
async function getStockSummary(lowStockThreshold = 5) {
  const brands = await Brand.find({ isActive: true }).sort({
    displayOrder: 1,
    name: 1,
  });
  const plans = await Plan.find({ isActive: true }).sort({
    brandId: 1,
    displayOrder: 1,
    price: 1,
  });

  const summary = [];
  const lowStockAlerts = [];

  for (const plan of plans) {
    const brand = brands.find(
      (b) => b._id.toString() === plan.brandId.toString(),
    );
    if (!brand) continue;

    const [unusedCount, usedCount] = await Promise.all([
      Stock.countDocuments({ planId: plan._id, isUsed: false }),
      Stock.countDocuments({ planId: plan._id, isUsed: true }),
    ]);

    const item = {
      brandId: brand._id,
      brandName: brand.name,
      brandEmoji: brand.emoji,
      planId: plan._id,
      planLabel: plan.label,
      price: plan.price,
      currency: plan.currency,
      availableStock: unusedCount,
      usedStock: usedCount,
      totalStock: unusedCount + usedCount,
      isLowStock: unusedCount < lowStockThreshold,
    };

    summary.push(item);

    if (unusedCount < lowStockThreshold) {
      lowStockAlerts.push(item);
    }
  }

  // Also include any WooCommerce specific stock entries
  const wooStocks = await Stock.aggregate([
    { $match: { wooVariationId: { $ne: null } } },
    {
      $group: {
        _id: "$wooVariationId",
        wooProductId: { $first: "$wooProductId" },
        productName: { $first: "$productName" },
        variationName: { $first: "$variationName" },
        availableStock: {
          $sum: { $cond: [{ $eq: ["$isUsed", false] }, 1, 0] },
        },
        usedStock: { $sum: { $cond: [{ $eq: ["$isUsed", true] }, 1, 0] } },
        totalStock: { $sum: 1 },
      },
    },
  ]);

  for (const ws of wooStocks) {
    const item = {
      wooVariationId: ws._id,
      wooProductId: ws.wooProductId,
      brandName: ws.productName || "WooCommerce Product",
      planLabel: ws.variationName || `Variation #${ws._id}`,
      availableStock: ws.availableStock,
      usedStock: ws.usedStock,
      totalStock: ws.totalStock,
      isLowStock: ws.availableStock < lowStockThreshold,
    };
    summary.push(item);
    if (ws.availableStock < lowStockThreshold) {
      lowStockAlerts.push(item);
    }
  }

  return { summary, lowStockAlerts };
}

module.exports = {
  assignStockToOrder,
  bulkAddStock,
  getAvailableStockCount,
  getStockSummary,
};
