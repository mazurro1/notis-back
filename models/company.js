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
    reservations: [
      {
        userIdWhoReserved: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          required: false,
        },
        userIdWhoDoService: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          required: false,
        },
        dateFrom: {
          type: String,
          required: false,
        },
        dateTo: {
          type: String,
          required: false,
        },
        visitMade: {
          type: Boolean,
          required: false,
        },
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
    opinions: [
      {
        userIdWhoWrite: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          required: false,
        },
        opinionText: {
          type: String,
          required: false,
        },
        opinionValue: {
          type: Number,
          required: false,
        },
        opinionDate: {
          type: String,
          required: false,
        },
        replyText: {
          type: String,
          required: false,
        },
      },
    ],
    opinionsCount: {
      type: Number,
      required: false,
    },
    opinionsValue: {
      type: String,
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
    reports: [
      {
        userWhoReport: {
          type: Schema.Types.ObjectId,
          ref: "Users",
          required: false,
        },
        reportText: {
          type: String,
          required: false,
        },
        reportDate: {
          type: String,
          required: false,
        },
      },
    ],
    mainImageUrl: {
      type: String,
      required: false,
    },
    imagesUrl: {
      type: String,
      required: false,
    },
    logoUrl: {
      type: String,
      required: false,
    },
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
        dayWeekIndex: {
          type: Date,
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
            category: {
              type: String,
              required: false,
            },
            serviceName: {
              type: String,
              required: false,
            },
          },
        ],
      },
    ],
    happyHoursNoConst: [
      {
        disabled: {
          type: Boolean,
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
        promotionPercent: {
          type: Number,
          required: false,
        },
        servicesInPromotion: [
          {
            category: {
              type: String,
              required: false,
            },
            serviceName: {
              type: String,
              required: false,
            },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Companys", companySchema);
