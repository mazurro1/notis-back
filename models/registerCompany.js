const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const registerCompanySchema = new Schema(
  {
    nip: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RegisterCompanys", registerCompanySchema);
