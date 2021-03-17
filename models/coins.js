const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const coinsSchema = new Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    priceId: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    avaibleCount: {
      type: Number,
      required: false,
    },
    countCoins: {
      type: Number,
      required: true,
    },
    promotionPrice: {
      type: Number,
      required: false,
    },
    name: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    userCreated: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    disabled: {
      type: Boolean,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Coins", coinsSchema);
