const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const invoiceSchema = new Schema(
  {
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
      required: true,
    },
    day: {
      type: Number,
      required: true,
    },
    link: {
      type: String,
      required: false,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: true,
    },
    sessionId: {
      type: String,
      required: false,
    },
    invoiceNumber: {
      type: Number,
      required: false,
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Invoices", invoiceSchema);
