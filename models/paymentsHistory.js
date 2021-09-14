const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const paymentsHistorySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: false,
    },
    sessionId: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      required: false,
    },
    buyingUserId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    productsInfo: [
      {
        coinsId: {
          type: Schema.Types.ObjectId,
          ref: "Coins",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        sms: {
          type: Number,
          required: false,
        },
        premium: {
          type: Number,
          required: false,
        },
      },
    ],
    datePayment: {
      type: Date,
      required: false,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoices",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PaymentsHistory", paymentsHistorySchema);
