const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reserwationSchema = new Schema(
  {
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

    isDeleted: {
      type: Boolean,
      required: false,
    },

    oldReserwationId: {
      type: Schema.Types.ObjectId,
      ref: "Reserwations",
      required: false,
    },

    hasCommuniting: {
      type: Boolean,
      required: false,
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
      type: Number,
      required: false,
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
      required: false,
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
    activePromotion: {
      type: Boolean,
      required: false,
    },
    activeHappyHour: {
      type: Boolean,
      required: false,
    },
    activeStamp: {
      type: Boolean,
      required: false,
    },
    basicPrice: {
      type: String,
      required: false,
    },
    opinionId: {
      type: Schema.Types.ObjectId,
      ref: "Opinions",
      required: false,
    },
    isDraft: {
      type: Boolean,
      required: false,
    },
    sendSMSReserwation: {
      type: Boolean,
      required: false,
    },
    sendSMSReserwationUserChanged: {
      type: Boolean,
      required: false,
    },
    sendSMSNotifaction: {
      type: Boolean,
      required: false,
    },
    sendSMSCanceled: {
      type: Boolean,
      required: false,
    },
    sendSMSChanged: {
      type: Boolean,
      required: false,
    },
    communitingId: {
      type: Schema.Types.ObjectId,
      ref: "Communitings",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Reserwations", reserwationSchema);
