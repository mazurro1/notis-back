const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    surname: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    hasPhone: {
      type: Boolean,
      required: false,
    },
    password: {
      type: String,
      required: true,
    },
    // dateBirth: {
    //   type: Number,
    //   required: false,
    // },
    // monthBirth: {
    //   type: Number,
    //   required: false,
    // },
    imageUrl: {
      type: String,
      required: false,
    },
    loginToken: {
      type: String,
      required: false,
    },
    accountVerified: {
      type: Boolean,
      required: true,
    },
    codeToVerified: {
      type: String,
      required: false,
    },
    codeToResetPassword: {
      type: String,
      required: false,
    },
    dateToResetPassword: {
      type: Date,
      required: false,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: "Companys",
      required: false,
    },
    hasCompany: {
      type: Boolean,
      required: false,
    },
    stamps: [
      {
        companyId: {
          type: Schema.Types.ObjectId,
          ref: "Companys",
          required: false,
        },
        reserwations: [
          {
            type: Schema.Types.ObjectId,
            ref: "Reserwations",
            required: false,
          },
        ],
      },
    ],
    favouritesCompanys: [
      {
        type: Schema.Types.ObjectId,
        ref: "Companys",
        required: false,
      },
    ],
    alertActiveCount: {
      type: Number,
      required: false,
    },
    alerts: [
      {
        reserwationId: {
          type: Schema.Types.ObjectId,
          ref: "Reserwations",
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
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Users", userSchema);
