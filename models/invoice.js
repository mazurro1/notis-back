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
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Invoices", invoiceSchema);
