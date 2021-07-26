const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    alertDefaultCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: false,
    },
    reserwationId: {
      type: Schema.Types.ObjectId,
      ref: "Reserwations",
      required: false,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Services",
      required: false,
    },
    communitingId: {
      type: Schema.Types.ObjectId,
      ref: "Communitings",
      required: false,
    },
    active: {
      type: Boolean,
      required: false,
    },
    type: {
      type: String,
      required: false,
    },
    creationTime: {
      type: Date,
      required: false,
    },
    companyChanged: {
      type: Boolean,
      required: false,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Alerts", userSchema);
