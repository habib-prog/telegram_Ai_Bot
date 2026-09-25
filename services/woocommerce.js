const axios = require("axios");

class WooCommerceService {
  constructor() {
    this.baseUrl = (
      process.env.WOOCOMMERCE_URL || "https://ipdokan.com"
    ).replace(/\/$/, "");
    this.consumerKey =
      process.env.WOOCOMMERCE_CONSUMER_KEY;
    this.consumerSecret =
      process.env.WOOCOMMERCE_CONSUMER_SECRET;

    // In-memory cache for fast Telegram bot responses
    this.cache = {
      categories: null,
      productsByCat: {},
      allProducts: null,
      variations: {},
      lastFetch: 0,
    };
    this.cacheTtl = 60 * 1000; // 1 minute
  }

  getAuthParams() {
    return {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
    };
  }

  /**
   * Fetch all active categories from WooCommerce
   */
  async getCategories(forceRefresh = false) {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cache.categories &&
      now - this.cache.lastFetch < this.cacheTtl
    ) {
      return this.cache.categories;
    }

    const categories = await this.request("products/categories", {
      params: { per_page: 100, hide_empty: true },
    });

    const formatted = categories
      .filter((c) => c.count > 0)
      .map((c) => {
        let emoji = "📁";
        const nameUpper = c.name.toUpperCase();
        if (nameUpper.includes("GB")) emoji = "🌐";
        else if (nameUpper.includes("IP")) emoji = "🔢";
        else if (nameUpper.includes("DISCOUNT") || nameUpper.includes("PROXY"))
          emoji = "⚡";
        else if (nameUpper.includes("SERVER")) emoji = "🖥️";
        else if (nameUpper.includes("VPS")) emoji = "🚀";
        else if (nameUpper.includes("STATIC")) emoji = "🔒";

        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          count: c.count,
          parent: c.parent,
          emoji,
        };
      });

    this.cache.categories = formatted;
    this.cache.lastFetch = now;
    return formatted;
  }

  /**
   * Fetch products for any category dynamically
   */
  async getProductsByCategory(categoryId, forceRefresh = false) {
    const now = Date.now();
    const cacheKey = `cat_${categoryId}`;

    if (
      !forceRefresh &&
      this.cache.productsByCat[cacheKey] &&
      now - this.cache.lastFetch < this.cacheTtl
    ) {
      return this.cache.productsByCat[cacheKey];
    }

    const products = await this.request("products", {
      params: { category: categoryId, status: "publish", per_page: 100 },
    });

    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      type: p.type,
      hasVariations:
        p.type === "variable" && p.variations && p.variations.length > 0,
      variationsCount: p.variations ? p.variations.length : 0,
      image: p.images?.[0]?.src || "",
      inStock: p.stock_status === "instock",
    }));

    this.cache.productsByCat[cacheKey] = formatted;
    return formatted;
  }

  async request(endpoint, options = {}) {
    if (!this.consumerKey || !this.consumerSecret) {
      throw new Error(
        "WooCommerce credentials are missing. Set WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET in .env.",
      );
    }
    const url = `${this.baseUrl}/wp-json/wc/v3/${endpoint.replace(/^\//, "")}`;
    const params = {
      ...this.getAuthParams(),
      ...(options.params || {}),
    };

    try {
      const response = await axios({
        url,
        method: options.method || "GET",
        params,
        data: options.data,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "IPDokanTelegramBot/1.0",
          ...(options.headers || {}),
        },
        timeout: 15000,
      });
      return response.data;
    } catch (err) {
      console.error(
        `[WooCommerce API Error] ${endpoint}:`,
        err.response?.data || err.message,
      );
      throw err;
    }
  }

  /**
   * Fetch products filtered by Type: 'gb' or 'ip'
   */
  async getProductsByType(type = "gb", forceRefresh = false) {
    const now = Date.now();
    const cacheKey = type === "gb" ? "gbProducts" : "ipProducts";

    if (
      !forceRefresh &&
      this.cache[cacheKey] &&
      now - this.cache.lastFetch < this.cacheTtl
    ) {
      return this.cache[cacheKey];
    }

    // Fetch all active products
    const allProducts = await this.request("products", {
      params: { status: "publish", per_page: 100 },
    });

    const filtered = allProducts.filter((p) => {
      if (type === "gb") {
        return (
          p.categories?.some((c) => c.slug === "gb" || c.id === 73) ||
          /GB/i.test(p.name)
        );
      }
      if (type === "ip") {
        return (
          p.categories?.some((c) => c.slug === "ip" || c.id === 72) ||
          /\bIP\b/i.test(p.name)
        );
      }
      return false;
    });

    // Format products for Telegram menu
    const formatted = filtered.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      type: p.type,
      hasVariations:
        p.type === "variable" && p.variations && p.variations.length > 0,
      variationsCount: p.variations ? p.variations.length : 0,
      image: p.images?.[0]?.src || "",
      inStock: p.stock_status === "instock",
    }));

    this.cache[cacheKey] = formatted;
    this.cache.lastFetch = now;
    return formatted;
  }

  /**
   * Fetch variations for a variable product with live stock and pricing
   */
  async getProductVariations(productId, forceRefresh = false) {
    const now = Date.now();
    const cached = this.cache.variations[productId];

    if (!forceRefresh && cached && now - cached.timestamp < this.cacheTtl) {
      return cached.data;
    }

    const variations = await this.request(`products/${productId}/variations`, {
      params: { per_page: 50 },
    });

    const formatted = variations.map((v) => {
      // Find attribute label (e.g. "1 GB", "25 IPs")
      const attrOption =
        v.attributes?.map((a) => a.option).join(" - ") || `Variation #${v.id}`;
      return {
        id: v.id,
        productId,
        name: attrOption,
        price: v.price || v.regular_price,
        stockQuantity: v.stock_quantity,
        stockStatus: v.stock_status, // 'instock' or 'outofstock'
        inStock:
          v.stock_status === "instock" &&
          (v.stock_quantity === null || v.stock_quantity > 0),
        permalink: v.permalink,
      };
    });

    // Sort variations by price ascending
    formatted.sort(
      (a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0),
    );

    this.cache.variations[productId] = {
      timestamp: now,
      data: formatted,
    };

    return formatted;
  }

  /**
   * Get single product details
   */
  async getProduct(productId) {
    return await this.request(`products/${productId}`);
  }

  /**
   * Create an order in WooCommerce
   * Returns order id and payment_url
   */
  async createOrder({
    telegramId,
    telegramUsername,
    firstName,
    productId,
    variationId,
    quantity = 1,
    note = "",
  }) {
    const email = `tg_${telegramId}@ipdokan.com`;
    const customerName =
      firstName || telegramUsername || `TG User ${telegramId}`;

    const lineItem = {
      product_id: parseInt(productId, 10),
      quantity: parseInt(quantity, 10) || 1,
    };
    if (variationId) {
      lineItem.variation_id = parseInt(variationId, 10);
    }

    const orderData = {
      status: "pending",
      set_paid: false,
      billing: {
        first_name: customerName,
        last_name: telegramUsername ? `@${telegramUsername}` : "",
        email,
        phone: "01700000000",
        country: "BD",
      },
      line_items: [lineItem],
      customer_note:
        note ||
        `Order placed via Telegram Bot by @${telegramUsername || telegramId}`,
      meta_data: [
        { key: "_telegram_id", value: String(telegramId) },
        { key: "_telegram_username", value: telegramUsername || "" },
        { key: "_created_via", value: "telegram_bot" },
      ],
    };

    try {
      const createdOrder = await this.request("orders", {
        method: "POST",
        data: orderData,
      });

      // Extract checkout payment URL
      let paymentUrl = createdOrder.payment_url;
      if (!paymentUrl) {
        paymentUrl = `${this.baseUrl}/checkout/order-pay/${createdOrder.id}/?pay_for_order=true&key=${createdOrder.order_key}`;
      }

      return {
        id: createdOrder.id,
        orderKey: createdOrder.order_key,
        total: createdOrder.total,
        currency: createdOrder.currency || "BDT",
        status: createdOrder.status,
        paymentUrl,
        lineItems: createdOrder.line_items,
        isDirectCheckout: false,
      };
    } catch (err) {
      const isWritePermissionError =
        err.response?.status === 401 ||
        err.response?.data?.code === "woocommerce_rest_authentication_error" ||
        /write permissions/i.test(err.response?.data?.message || "");
      if (isWritePermissionError) {
        throw new Error(
          "WooCommerce API key needs Read/Write permission. Create a new Read/Write key in WooCommerce → Settings → Advanced → REST API, then update .env and restart the bot.",
        );
      }
      throw err;
    }
  }

  /**
   * Fetch single order from WooCommerce by ID
   */
  async getOrder(orderId) {
    return await this.request(`orders/${orderId}`);
  }

  /** Cancel an unpaid WooCommerce order without deleting its accounting record. */
  async cancelOrder(orderId) {
    const order = await this.request(`orders/${orderId}`, {
      method: "PUT",
      data: { status: "cancelled" },
    });
    this.clearProductCache();
    return order;
  }

  clearProductCache() {
    this.cache.productsByCat = {};
    this.cache.allProducts = null;
    this.cache.variations = {};
    this.cache.lastFetch = 0;
  }

  /**
   * Check order status
   */
  async isOrderPaid(orderId) {
    try {
      const order = await this.getOrder(orderId);
      const paidStatuses = ["processing", "completed"];
      return {
        isPaid: paidStatuses.includes(order.status),
        status: order.status,
        total: order.total,
        order,
      };
    } catch (err) {
      console.error(
        `[WooCommerce isOrderPaid error] for #${orderId}:`,
        err.message,
      );
      return { isPaid: false, error: err.message };
    }
  }
}

module.exports = new WooCommerceService();
