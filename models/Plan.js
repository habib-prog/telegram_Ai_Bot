const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true, // e.g. "1 GB - 30 Days", "5 GB - Unlimited"
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'BDT',
      uppercase: true,
      trim: true,
    },
    durationDays: {
      type: Number,
      default: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Plan || mongoose.model('Plan', planSchema);
