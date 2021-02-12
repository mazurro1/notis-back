const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const companyAvailabilitySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: true,
    },

    items: [
      {
        itemName: {
          type: String,
          required: false,
        },
        itemCount: {
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

module.exports = mongoose.model(
  "CompanyAvailability",
  companyAvailabilitySchema
);
