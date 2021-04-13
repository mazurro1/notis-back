const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reportSchema = new Schema(
  {
    whoReportedUser: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    reportedUser: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: false,
    },
    reportedCompany: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: false,
    },
    reportedValue: {
      type: Number,
      required: true,
    },
    opinionId: {
      type: Schema.Types.ObjectId,
      ref: "Opinions",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Reports", reportSchema);
