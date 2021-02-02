const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const opinionSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    opinionMessage: {
      type: String,
      required: false,
    },
    opinionStars: {
      type: Number,
      required: false,
    },
    editedOpinionMessage: {
      type: String,
      required: false,
    },
    replayOpinionMessage: {
      type: String,
      required: false,
    },
    reserwationId: {
      type: Schema.Types.ObjectId,
      ref: "Reserwations",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Opinions", opinionSchema);
