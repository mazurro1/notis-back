const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const companySchema = new Schema(
  {
    linkPath: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    nip: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    adress: {
      type: String,
      required: true,
    },
    reserationText: {
      type: String,
      required: false,
    },
    title: {
      type: String,
      required: false,
    },
    companyType: [
      {
        type: Number,
        required: false,
      },
    ],
    accountVerified: {
      type: Boolean,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    customerStripeId: {
      type: String,
      required: false,
    },
    payments: [
      {
        sessionId: {
          type: String,
          required: false,
        },
        status: {
          type: String,
          required: false,
        },
        buyingUserId: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          required: true,
        },
        productsInfo: [
          {
            coinsId: {
              type: Schema.Types.ObjectId,
              ref: "Coins",
              required: true,
            },
            name: {
              type: String,
              required: true,
            },
            price: {
              type: Number,
              required: true,
            },
            sms: {
              type: Number,
              required: false,
            },
            premium: {
              type: Number,
              required: false,
            },
          },
        ],
        datePayment: {
          type: Date,
          required: false,
        },
        invoiceId: {
          type: Schema.Types.ObjectId,
          ref: "Invoices",
          required: false,
        },
      },
    ],
    sms: {
      type: Number,
      required: false,
      min: 0,
    },
    smsReserwationAvaible: {
      type: Boolean,
      required: false,
    },
    smsNotifactionAvaible: {
      type: Boolean,
      required: false,
    },
    smsCanceledAvaible: {
      type: Boolean,
      required: false,
    },
    smsChangedAvaible: {
      type: Boolean,
      required: false,
    },
    raportSMS: [
      {
        year: {
          type: Number,
          required: false,
        },
        month: {
          type: Number,
          required: false,
        },
        count: {
          type: Number,
          required: false,
        },
        isAdd: {
          type: Boolean,
          required: false,
        },
        title: {
          type: String,
          required: false,
        },
      },
    ],
    premium: {
      type: Date,
      required: false,
    },
    maps: {
      lat: {
        type: String,
        required: false,
      },
      long: {
        type: String,
        required: false,
      },
    },
    daysOff: [
      {
        day: {
          type: Number,
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
    ],
    ownerData: {
      email: {
        type: String,
        required: false,
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: false,
      },
      specialization: {
        type: String,
        required: false,
      },
      noConstantWorkingHours: [
        {
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
      ],
      constantWorkingHours: [
        {
          dayOfTheWeek: {
            type: Number,
            required: false,
          },
          startWorking: {
            type: String,
            required: false,
          },
          endWorking: {
            type: String,
            required: false,
          },
          disabled: {
            type: Boolean,
            required: false,
          },
        },
      ],
      active: {
        type: Boolean,
        required: false,
      },
      codeToActive: {
        type: String,
        required: false,
      },
      permissions: [
        {
          type: String,
          required: false,
        },
      ],
      servicesCategory: [
        {
          type: String,
          required: false,
        },
      ],
    },
    pauseCompany: {
      type: Boolean,
      required: true,
    },
    codeToVerified: {
      type: String,
      required: false,
    },
    openingDays: {
      mon: {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
      },
      tue: {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
      },
      wed: {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
      },
      thu: {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
      },
      fri: {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
      },
      sat: {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
      },
      sun: {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
      },
    },

    reservationMonthTime: {
      type: Number,
      required: false,
    },
    reservationEveryTime: {
      type: Number,
      required: false,
    },

    workers: [
      {
        email: {
          type: String,
          required: false,
        },
        user: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          required: false,
        },
        specialization: {
          type: String,
          required: false,
        },
        noConstantWorkingHours: [
          {
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
        ],
        constantWorkingHours: [
          {
            dayOfTheWeek: {
              type: Number,
              required: false,
            },
            startWorking: {
              type: String,
              required: false,
            },
            endWorking: {
              type: String,
              required: false,
            },
            disabled: {
              type: Boolean,
              required: false,
            },
          },
        ],
        active: {
          type: Boolean,
          required: false,
        },
        codeToActive: {
          type: String,
          required: false,
        },
        permissions: [
          {
            type: Number,
            required: false,
          },
        ],
        servicesCategory: [
          {
            type: String,
            required: false,
          },
        ],
      },
    ],
    services: [
      {
        serviceCategory: {
          type: String,
          required: false,
        },
        serviceName: {
          type: String,
          required: false,
        },
        serviceText: {
          type: String,
          required: false,
        },
        serviceCost: {
          type: String,
          required: false,
        },
        extraCost: {
          type: Boolean,
          required: false,
        },
        time: {
          type: Number,
          required: false,
        },
        extraTime: {
          type: Boolean,
          required: false,
        },
        serviceColor: {
          type: Number,
          required: false,
        },
      },
    ],
    opinionsCount: {
      type: Number,
      required: false,
    },
    opinionsValue: {
      type: Number,
      required: false,
    },
    messangerAvaible: {
      type: Boolean,
      required: true,
    },
    messangerPageId: {
      type: String,
      required: false,
    },
    messangerAppId: {
      type: String,
      required: false,
    },
    messangerHtmlRef: {
      type: String,
      required: false,
    },
    linkFacebook: {
      type: String,
      required: false,
    },
    linkiWebsite: {
      type: String,
      required: false,
    },
    linkInstagram: {
      type: String,
      required: false,
    },
    mainImageUrl: {
      type: String,
      required: false,
    },
    imagesUrl: [
      {
        type: String,
        required: false,
      },
    ],
    usersInformation: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          required: false,
        },
        isBlocked: {
          type: Boolean,
          required: false,
        },
        reserwationsCount: {
          type: Number,
          required: false,
        },
      },
    ],
    happyHoursConst: [
      {
        disabled: {
          type: Boolean,
          required: false,
        },
        dayWeekIndex: [
          {
            type: Number,
            required: false,
          },
        ],
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
        promotionPercent: {
          type: Number,
          required: false,
        },
        servicesInPromotion: [
          {
            type: String,
            required: false,
          },
        ],
      },
    ],
    promotions: [
      {
        disabled: {
          type: Boolean,
          required: false,
        },
        start: {
          type: String,
          required: false,
        },
        end: {
          type: String,
          required: false,
        },
        promotionPercent: {
          type: Number,
          required: false,
        },
        servicesInPromotion: [
          {
            type: String,
            required: false,
          },
        ],
      },
    ],
    companyStamps: [
      {
        disabled: {
          type: Boolean,
          required: false,
        },
        promotionPercent: {
          type: Number,
          required: false,
        },
        countStampsToActive: {
          type: Number,
          required: false,
        },
        servicesId: [
          {
            type: String,
            required: false,
          },
        ],
      },
    ],
    shopStore: [
      {
        category: {
          type: String,
          required: false,
        },
        items: [
          {
            name: {
              type: String,
              required: false,
            },
            description: {
              type: String,
              required: false,
            },
            count: {
              type: String,
              required: false,
            },
            price: {
              type: Number,
              required: false,
            },
            disabled: {
              type: Boolean,
              required: false,
            },
          },
        ],
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
    notifactionNoSMS: {
      type: Boolean,
      required: false,
    },
    notifactionNoPremium: {
      type: Boolean,
      required: false,
    },
    dataToInvoice: {
      name: {
        type: String,
        required: false,
      },
      city: {
        type: String,
        required: false,
      },
      postalCode: {
        type: String,
        required: false,
      },
      street: {
        type: String,
        required: false,
      },
    },
    dateUpdateNip: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Companys", companySchema);
