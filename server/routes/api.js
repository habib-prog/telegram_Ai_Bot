const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Brand = require("../../models/Brand");
const Plan = require("../../models/Plan");
const Stock = require("../../models/Stock");
const Order = require("../../models/Order");
const User = require("../../models/User");
const Admin = require("../../models/Admin");
const stockService = require("../../services/stockService");
const woocommerce = require("../../services/woocommerce");
const strings = require("../../bot/config/strings");
const { bot } = require("../../bot/index");
const { requireAdminAuth } = require("../middleware/auth");

const JWT_SECRET =
  process.env.JWT_SECRET || "default_super_secret_jwt_key_change_in_production";

// ==========================================
// 1. Authentication
// ==========================================
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    let isValid = false;

    // First check database Admin collection
    const adminUser = await Admin.findOne({ username });
    if (adminUser) {
      isValid = await adminUser.comparePassword(password);
    } else {
      // Fallback to environment variables
      const envUser = process.env.ADMIN_PANEL_USERNAME || "admin";
      const envHash = process.env.ADMIN_PANEL_PASSWORD_HASH;
      const envPlainPassword = process.env.ADMIN_PANEL_PASSWORD || "admin123";

      if (username === envUser) {
        if (envHash) {
          isValid = await bcrypt.compare(password, envHash);
        } else {
          isValid = password === envPlainPassword;
        }
      }
    }

    if (!isValid) {
      return res
        .status(401)
        .json({ error: "Invalid admin username or password" });
    }

    const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      success: true,
      token,
      user: { username, role: "admin" },
    });
  } catch (err) {
    console.error("[AuthLogin] Error:", err);
    return res.status(500).json({ error: "Server authentication error" });
  }
});

// Protect all subsequent /api routes with JWT
router.use(requireAdminAuth);

// ==========================================
// 2. Dashboard Statistics
// ==========================================
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayPaidOrders,
      weekPaidOrders,
      allPaidOrders,
      totalOrdersCount,
      pendingOrdersCount,
      totalCustomers,
      stockStats,
      recentOrders,
    ] = await Promise.all([
      Order.find({
        status: { $in: ["paid", "delivered", "processing", "completed"] },
        createdAt: { $gte: startOfToday },
      }),
      Order.find({
        status: { $in: ["paid", "delivered", "processing", "completed"] },
        createdAt: { $gte: startOfWeek },
      }),
      Order.find({
        status: { $in: ["paid", "delivered", "processing", "completed"] },
      }),
      Order.countDocuments(),
      Order.countDocuments({ status: "pending" }),
      User.countDocuments(),
      stockService.getStockSummary(5),
      Order.find().sort({ createdAt: -1 }).limit(5),
    ]);

    const todayRevenue = todayPaidOrders.reduce(
      (sum, o) => sum + (o.amount || 0),
      0,
    );
    const weekRevenue = weekPaidOrders.reduce(
      (sum, o) => sum + (o.amount || 0),
      0,
    );
    const totalRevenue = allPaidOrders.reduce(
      (sum, o) => sum + (o.amount || 0),
      0,
    );

    return res.json({
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        total: totalRevenue,
      },
      orders: {
        today: todayPaidOrders.length,
        week: weekPaidOrders.length,
        totalPaid: allPaidOrders.length,
        totalAll: totalOrdersCount,
        pending: pendingOrdersCount,
      },
      customers: totalCustomers,
      lowStockAlerts: stockStats.lowStockAlerts,
      recentOrders,
    });
  } catch (err) {
    console.error("[GetStats] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. WooCommerce Integration Endpoints
// ==========================================
router.get("/woocommerce/products", async (req, res) => {
  try {
    const type = req.query.type || "all";
    if (type === "gb" || type === "ip") {
      const products = await woocommerce.getProductsByType(type);
      return res.json(products);
    }
    const [gb, ip] = await Promise.all([
      woocommerce.getProductsByType("gb"),
      woocommerce.getProductsByType("ip"),
    ]);
    return res.json({ gb, ip });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/woocommerce/products/:id/variations", async (req, res) => {
  try {
    const variations = await woocommerce.getProductVariations(req.params.id);
    return res.json(variations);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/woocommerce/sync", async (req, res) => {
  try {
    const [gbProducts, ipProducts] = await Promise.all([
      woocommerce.getProductsByType("gb", true),
      woocommerce.getProductsByType("ip", true),
    ]);

    let syncedBrands = 0;
    let syncedPlans = 0;

    const allProds = [
      ...gbProducts.map((p) => ({ ...p, proxyType: "gb" })),
      ...ipProducts.map((p) => ({ ...p, proxyType: "ip" })),
    ];

    for (const p of allProds) {
      const brand = await Brand.findOneAndUpdate(
        { name: p.name },
        {
          $set: {
            name: p.name,
            emoji: p.proxyType === "gb" ? "🌐" : "🔢",
            description: `WooCommerce ID: ${p.id}`,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      );
      syncedBrands++;

      if (p.hasVariations) {
        const variations = await woocommerce.getProductVariations(p.id, true);
        for (const v of variations) {
          await Plan.findOneAndUpdate(
            { brandId: brand._id, label: v.name },
            {
              $set: {
                brandId: brand._id,
                label: v.name,
                price: parseFloat(v.price) || 0,
                currency: "BDT",
                isActive: v.inStock,
              },
            },
            { upsert: true },
          );
          syncedPlans++;
        }
      }
    }

    return res.json({
      success: true,
      message: `Synchronized ${syncedBrands} brands and ${syncedPlans} packages from ipdokan.com!`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. Brands CRUD
// ==========================================
router.get("/brands", async (req, res) => {
  try {
    const brands = await Brand.find().sort({ displayOrder: 1, name: 1 });
    return res.json(brands);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/brands", async (req, res) => {
  try {
    const { name, emoji, description, isActive, displayOrder } = req.body;
    if (!name) return res.status(400).json({ error: "Brand name is required" });

    const brand = await Brand.create({
      name,
      emoji: emoji || "🌐",
      description: description || "",
      isActive: isActive !== false,
      displayOrder: Number(displayOrder) || 0,
    });
    return res.status(201).json(brand);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put("/brands/:id", async (req, res) => {
  try {
    const updated = await Brand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Brand not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/brands/:id", async (req, res) => {
  try {
    const brandId = req.params.id;
    const plansCount = await Plan.countDocuments({ brandId });
    if (plansCount > 0) {
      return res.status(400).json({
        error: `Cannot delete brand with ${plansCount} existing plans. Delete or reassign plans first.`,
      });
    }
    await Brand.findByIdAndDelete(brandId);
    return res.json({ success: true, message: "Brand deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. Plans CRUD
// ==========================================
router.get("/plans", async (req, res) => {
  try {
    const filter = {};
    if (req.query.brandId) filter.brandId = req.query.brandId;

    const plans = await Plan.find(filter)
      .populate("brandId", "name emoji")
      .sort({ brandId: 1, displayOrder: 1, price: 1 });
    return res.json(plans);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/plans", async (req, res) => {
  try {
    const {
      brandId,
      label,
      price,
      currency,
      durationDays,
      isActive,
      displayOrder,
    } = req.body;
    if (!brandId || !label || price === undefined) {
      return res
        .status(400)
        .json({ error: "Brand, label, and price are required" });
    }

    const plan = await Plan.create({
      brandId,
      label,
      price: Number(price),
      currency: currency || "BDT",
      durationDays: Number(durationDays) || 30,
      isActive: isActive !== false,
      displayOrder: Number(displayOrder) || 0,
    });
    return res.status(201).json(plan);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put("/plans/:id", async (req, res) => {
  try {
    const updated = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Plan not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/plans/:id", async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Plan deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. Stock Management
// ==========================================
router.get("/stock/summary", async (req, res) => {
  try {
    const threshold = Number(req.query.threshold) || 5;
    const data = await stockService.getStockSummary(threshold);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/stock", async (req, res) => {
  try {
    const { brandId, planId, isUsed, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (brandId) filter.brandId = brandId;
    if (planId) filter.planId = planId;
    if (isUsed !== undefined && isUsed !== "")
      filter.isUsed = isUsed === "true";

    const skip = (Number(page) - 1) * Number(limit);

    const [stockItems, totalCount] = await Promise.all([
      Stock.find(filter)
        .populate("brandId", "name")
        .populate("planId", "label")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Stock.countDocuments(filter),
    ]);

    return res.json({
      items: stockItems,
      total: totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/stock/bulk", async (req, res) => {
  try {
    const {
      brandId,
      planId,
      wooProductId,
      wooVariationId,
      productName,
      variationName,
      credentials,
      batchNote,
    } = req.body;
    if (!credentials) {
      return res.status(400).json({ error: "Credentials are required" });
    }

    const result = await stockService.bulkAddStock(
      {
        brandId,
        planId,
        wooProductId,
        wooVariationId,
        productName,
        variationName,
      },
      credentials,
      batchNote,
    );
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/stock/:id", async (req, res) => {
  try {
    const item = await Stock.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Stock item not found" });
    if (item.isUsed) {
      return res
        .status(400)
        .json({
          error:
            "Cannot delete stock item that has already been delivered to a customer",
        });
    }
    await Stock.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Stock item removed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. Orders Management
// ==========================================
router.get("/orders", async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const searchNum = Number(search);
      const orConditions = [
        { orderId: { $regex: search, $options: "i" } },
        { wooOrderId: { $regex: search, $options: "i" } },
        { productName: { $regex: search, $options: "i" } },
        { telegramUsername: { $regex: search, $options: "i" } },
      ];
      if (!isNaN(searchNum)) {
        orConditions.push({ telegramId: searchNum });
      }
      filter.$or = orConditions;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, totalCount] = await Promise.all([
      Order.find(filter)
        .populate("brandId", "name emoji")
        .populate("planId", "label price currency")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    return res.json({
      orders,
      total: totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Manual Deliver Order by Admin
router.post("/orders/:id/deliver", async (req, res) => {
  const { credentials } = req.body;
  if (!credentials) {
    return res
      .status(400)
      .json({ error: "Credentials are required for manual delivery" });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "delivered";
    order.deliveredCredentials = credentials;
    order.deliveredAt = new Date();
    await order.save();

    // Send Telegram message to user
    try {
      const message = strings.deliverySuccess(
        order.productName || "Proxy",
        order.variationName || "",
        credentials,
        order.orderId,
      );
      await bot.telegram.sendMessage(order.telegramId, message, {
        parse_mode: "HTML",
      });
    } catch (tgErr) {
      console.error("Failed to send Telegram message:", tgErr.message);
    }

    return res.json({
      success: true,
      message: "Order delivered and customer notified.",
      order,
    });
  } catch (err) {
    console.error("[ManualDelivery] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Clear Orders (All or Filtered)
router.delete("/orders/clear", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    const result = await Order.deleteMany(filter);
    return res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} orders successfully.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
