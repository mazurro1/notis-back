const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const raportSMSSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: false,
    },
    year: {
      type: Number,
      required: false,
    },
    month: {
      type: Number,
      required: false,
    },
    count: {
      type: Number,
      required: false,
    },
    isAdd: {
      type: Boolean,
      required: false,
    },
    title: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RaportSMS", raportSMSSchema);
