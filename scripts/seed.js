require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Brand = require("../models/Brand");
const Plan = require("../models/Plan");
const Stock = require("../models/Stock");
const Admin = require("../models/Admin");
const woocommerce = require("../services/woocommerce");

async function seed() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/telegram_proxy_store";
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);

  console.log("🌱 Starting database seed...");

  // 1. Seed or update Admin user
  const adminUsername = process.env.ADMIN_PANEL_USERNAME || "admin";
  const plainPassword = process.env.ADMIN_PANEL_PASSWORD || "admin123";
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  await Admin.findOneAndUpdate(
    { username: adminUsername },
    { $set: { password: hashedPassword, role: "superadmin" } },
    { upsert: true, new: true },
  );
  console.log(`👤 Admin user verified/created: "${adminUsername}"`);

  // 2. Sync products directly from ipdokan.com
  console.log("🔄 Fetching products from ipdokan.com...");
  try {
    const [gbProducts, ipProducts] = await Promise.all([
      woocommerce.getProductsByType("gb", true),
      woocommerce.getProductsByType("ip", true),
    ]);

    console.log(
      `📦 Found ${gbProducts.length} GB products and ${ipProducts.length} IP products.`,
    );

    const allProds = [
      ...gbProducts.map((p) => ({ ...p, proxyType: "gb" })),
      ...ipProducts.map((p) => ({ ...p, proxyType: "ip" })),
    ];

    for (const p of allProds) {
      const emoji = p.proxyType === "gb" ? "🌐" : "🔢";
      const brand = await Brand.findOneAndUpdate(
        { name: p.name },
        {
          $set: {
            name: p.name,
            emoji,
            description: `WooCommerce ID: ${p.id}`,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      );
      console.log(`➕ Synced Brand: ${brand.emoji} ${brand.name}`);

      if (p.hasVariations) {
        const variations = await woocommerce.getProductVariations(p.id, true);
        for (const v of variations) {
          const plan = await Plan.findOneAndUpdate(
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
            { upsert: true, new: true },
          );

          // Add a sample test stock if no stock exists for this variation
          const count = await Stock.countDocuments({ wooVariationId: v.id });
          if (count === 0) {
            await Stock.create({
              wooProductId: p.id,
              wooVariationId: v.id,
              productName: p.name,
              variationName: v.name,
              brandId: brand._id,
              planId: plan._id,
              credentials: `proxy.ipdokan.com:8080:user_${v.id}:pass_${Math.floor(1000 + Math.random() * 9000)}`,
              isUsed: false,
              batchNote: "Initial seed stock",
            });
          }
        }
        console.log(
          `   └─ Synced ${variations.length} packages for ${brand.name}`,
        );
      }
    }
  } catch (err) {
    console.error("⚠️ WooCommerce sync warning:", err.message);
  }

  console.log("\n✅ Database seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
