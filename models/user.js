const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    language: {
      type: String,
      required: false,
    },
    darkMode: {
      type: Boolean,
      required: false,
    },
    blindMode: {
      type: Boolean,
      required: false,
    },
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
    emailVerified: {
      type: Boolean,
      required: false,
    },
    emailToVerified: {
      type: String,
      required: false,
    },
    codeToVerifiedEmail: {
      type: String,
      required: false,
    },
    blockUserChangeEmail: {
      type: Date,
      required: false,
    },
    phoneVerified: {
      type: Boolean,
      required: false,
    },
    whiteListVerifiedPhones: [
      {
        type: String,
        required: false,
      },
    ],
    blockUserChangePhoneNumber: {
      type: Date,
      required: false,
    },
    blockUserSendVerifiedPhoneSms: {
      type: Date,
      required: false,
    },
    password: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    imageOther: {
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
    allCompanys: [
      {
        type: Schema.Types.ObjectId,
        ref: "Companys",
        required: false,
      },
    ],
    codeDelete: {
      type: String,
      required: false,
    },
    codeDeleteDate: {
      type: Date,
      required: false,
    },
    codeVerifiedPhone: {
      type: String,
      required: false,
    },
    codeVerifiedPhoneDate: {
      type: Date,
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
    vapidEndpoint: {
      endpoint: {
        type: String,
        required: false,
      },
      expirationTime: {
        type: Number,
        required: false,
      },
      keys: {
        p256dh: {
          type: String,
          required: false,
        },
        auth: {
          type: String,
          required: false,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Users", userSchema);
