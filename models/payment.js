const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const paymentSchema = new Schema(
  {
    price: {
      type: Number,
      required: true,
    },
    avaibleCount: {
      type: Number,
      required: false,
    },
    countSMS: {
      type: Number,
      required: true,
    },
    promotionPrice: {
      type: Number,
      required: false,
    },
    textCoins: {
      type: String,
      required: false,
    },
    userCreated: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payments", paymentSchema);
