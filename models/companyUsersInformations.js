const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const companyUsersInformationsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },

  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Companys",
    required: true,
  },

  messages: [
    {
      workerWhoWritedUserId: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      message: {
        type: String,
        required: false,
      },
      dateMessage: {
        type: Date,
        required: false,
      },
    },
  ],
});

module.exports = mongoose.model(
  "CompanysUsersInformations",
  companyUsersInformationsSchema
);
