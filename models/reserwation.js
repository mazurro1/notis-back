const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reserwationSchema = new Schema({
  fromUser: {
    type: Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },

  toWorkerUserId: {
    type: Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },

  serviceName: {
    type: String,
    required: false,
  },

  company: {
    type: Schema.Types.ObjectId,
    ref: "Companys",
    required: true,
  },

  dateYear: {
    type: Number,
    required: true,
  },

  dateMonth: {
    type: Number,
    required: true,
  },

  dateDay: {
    type: Number,
    required: true,
  },

  dateStart: {
    type: String,
    required: true,
  },

  dateEnd: {
    type: String,
    required: true,
  },

  fullDate: {
    type: Date,
    required: true,
  },

  costReserwation: {
    type: String,
    required: true,
  },

  extraCost: {
    type: Boolean,
    required: false,
  },

  extraTime: {
    type: Boolean,
    required: false,
  },

  timeReserwation: {
    type: String,
    required: true,
  },

  workerReserwation: {
    type: Boolean,
    required: true,
  },

  visitNotFinished: {
    type: Boolean,
    required: false,
  },
  visitCanceled: {
    type: Boolean,
    required: false,
  },

  visitChanged: {
    type: Boolean,
    required: false,
  },

  reserwationMessage: {
    type: String,
    required: false,
  },

  serviceId: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("Reserwations", reserwationSchema);
