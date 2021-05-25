const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const serviceSchema = new Schema(
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
    objectName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    cost: {
      type: Number,
      required: false,
    },
    statusValue: {
      type: Number,
      required: true,
    },
    dateStart: {
      type: Date,
      required: false,
    },
    dateService: {
      type: Date,
      required: false,
    },
    dateEnd: {
      type: Date,
      required: false,
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

module.exports = mongoose.model("Services", serviceSchema);
