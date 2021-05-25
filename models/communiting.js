const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const communitingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: false,
    },
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
    month: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    day: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: false,
    },
    surname: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: true,
    },
    cost: {
      type: Number,
      required: false,
    },
    timeStart: {
      type: String,
      required: true,
    },
    timeEnd: {
      type: String,
      required: true,
    },
    statusValue: {
      type: Number,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    dateStartValid: {
      type: Date,
      required: false,
    },
    dateCommunitingValid: {
      type: Date,
      required: false,
    },
    dateEndValid: {
      type: Date,
      required: false,
    },
    reserwationId: {
      type: Schema.Types.ObjectId,
      ref: "Reserwations",
      required: true,
    },
    opinionId: {
      type: Schema.Types.ObjectId,
      ref: "Opinions",
      required: false,
    },
    isDeleted: {
      type: Boolean,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Communitings", communitingSchema);
