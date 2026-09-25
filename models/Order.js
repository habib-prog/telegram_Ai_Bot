const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    wooOrderId: {
      type: String,
      default: null,
      index: true,
    },
    wooProductId: {
      type: Number,
      default: null,
    },
    wooVariationId: {
      type: Number,
      default: null,
    },
    productName: {
      type: String,
      default: "",
    },
    variationName: {
      type: String,
      default: "",
    },
    proxyType: {
      type: String,
      enum: ["gb", "ip", "other"],
      default: "gb",
    },
    telegramId: {
      type: Number,
      required: true,
      index: true,
    },
    telegramUsername: {
      type: String,
      default: "",
    },
    telegramFirstName: {
      type: String,
      default: "",
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: false,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: false,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "BDT",
    },
    gatewayTransactionId: {
      type: String,
      required: false,
      sparse: true,
    },
    gatewayRedirectUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "completed",
        "delivered",
        "stock_pending",
        "failed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    deliveredStockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stock",
      default: null,
    },
    deliveredCredentials: {
      type: String,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
