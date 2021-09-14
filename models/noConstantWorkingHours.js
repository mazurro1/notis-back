const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const noConstantWorkingHoursSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: true,
    },
    workerUserId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    fullDate: {
      type: String,
      required: false,
    },
    start: {
      type: Date,
      required: false,
    },
    end: {
      type: Date,
      required: false,
    },
    holidays: {
      type: Boolean,
      required: false,
    },
    month: {
      type: Number,
      required: false,
    },
    year: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "NoConstantWorkingHours",
  noConstantWorkingHoursSchema
);
