const schedule = require("node-schedule");
const Reserwation = require("../models/reserwation");
const Company = require("../models/company");
const User = require("../models/user");
const nodemailer = require("nodemailer");
const io = require("../socket");
const AWS = require("aws-sdk");
const Invoice = require("../models/invoice");
const { createInvoice } = require("../generateInvoice");
const Communiting = require("../models/Communiting");

require("dotenv").config();
const {
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  AWS_BUCKET,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_INFO,
  MAIL_PASSWORD,
} = process.env;

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: true,
  auth: {
    user: MAIL_INFO,
    pass: MAIL_PASSWORD,
  },
});

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID_APP,
  secretAccessKey: AWS_SECRET_ACCESS_KEY_APP,
  region: AWS_REGION_APP,
});

const s3Bucket = new AWS.S3({
  params: {
    Bucket: AWS_BUCKET,
  },
});

const updateCompanyFunction = async (
  itemCompany,
  title = "sms_notifaction_reserwation"
) => {
  try {
    const result = await Company.updateOne(
      {
        _id: itemCompany.companyId,
        sms: { $gte: itemCompany.allReserwations.length },
      },
      {
        $inc: {
          sms: -itemCompany.allReserwations.length,
        },
        $addToSet: {
          raportSMS: {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            count: itemCompany.allReserwations.length,
            isAdd: false,
            title: title,
          },
        },
      },
      { upsert: true, safe: true },
      null
    );
    if (!!result) {
      return true;
    } else {
      return false;
    }
  } catch {
    return false;
  }
};

//reserwation
for (let i = 0; i < 24; i++) {
  schedule.scheduleJob(
    `${i < 12 ? i * 5 : (i - 12) * 5} ${i < 12 ? 10 : 1 < 24 ? 11 : 12} * * *`,
    // `33 15 * * *`,
    async () => {
      const validDate = new Date(new Date().setDate(new Date().getDate() + 1));
      const dateStartValid = new Date(
        validDate.getFullYear(),
        validDate.getMonth(),
        validDate.getDate(),
        i,
        0,
        0,
        0
      );
      const dateStartValidEnd = new Date(
        validDate.getFullYear(),
        validDate.getMonth(),
        validDate.getDate(),
        i,
        59,
        59,
        59
      );
      Reserwation.find({
        dateYear: validDate.getFullYear(),
        dateMonth: validDate.getMonth() + 1,
        dateDay: validDate.getDate(),
        visitCanceled: false,
        isDraft: false,
        workerReserwation: false,
        fullDate: {
          $gte: dateStartValid.toISOString(),
          $lte: dateStartValidEnd.toISOString(),
        },
        isDeleted: { $in: [false, null] },
      })
        .select(
          "_id fromUser dateYear dateMonth dateDay toWorkerUserId serviceName dateStart dateEnd visitNotFinished visitCanceled visitChanged workerReserwation fullDate phone name surname email"
        )
        .populate(
          "company",
          "_id name city adress smsNotifactionAvaible pauseCompany linkPath email"
        )
        .populate(
          "fromUser",
          "_id name surname email phone whiteListVerifiedPhones phoneVerified"
        )
        .populate("toWorkerUserId", "name surname _id")
        .then((resultReserwations) => {
          const bulkArrayToUpdateUsers = [];
          resultReserwations.forEach((resultReserwation) => {
            if (!!resultReserwation.fromUser) {
              let itemReserwation = null;
              if (!!resultReserwation.fromUser._id) {
                if (!!resultReserwation.toWorkerUserId) {
                  if (
                    !!resultReserwation.toWorkerUserId._id &&
                    !!resultReserwation.company._id &&
                    !!resultReserwation.company.email
                  ) {
                    const userAlertToSave = {
                      reserwationId: resultReserwation._id,
                      active: true,
                      type: "reserwation_notifaction",
                      creationTime: new Date(),
                      companyChanged: true,
                    };

                    let customPhone = null;
                    if (!!resultReserwation.phone) {
                      customPhone = Buffer.from(
                        resultReserwation.phone,
                        "base64"
                      ).toString("utf-8");
                    }

                    itemReserwation = {
                      _id: resultReserwation._id,
                      fromUser: {
                        name: resultReserwation.fromUser.name,
                        surname: resultReserwation.fromUser.surname,
                        _id: resultReserwation.fromUser._id,
                      },
                      company: {
                        name: resultReserwation.company.name,
                        _id: resultReserwation.company._id,
                        linkPath: resultReserwation.company.linkPath,
                        email: resultReserwation.company.email,
                      },
                      toWorkerUserId: {
                        name: resultReserwation.toWorkerUserId.name,
                        _id: resultReserwation.toWorkerUserId._id,
                        surname: resultReserwation.toWorkerUserId.surname,
                      },
                      phone: customPhone,
                      name: !!resultReserwation.name
                        ? resultReserwation.name
                        : null,
                      surname: !!resultReserwation.surname
                        ? resultReserwation.surname
                        : null,
                      email: !!resultReserwation.email
                        ? resultReserwation.email
                        : null,
                      dateYear: resultReserwation.dateYear,
                      dateMonth: resultReserwation.dateMonth,
                      dateDay: resultReserwation.dateDay,
                      dateStart: resultReserwation.dateStart,
                      dateEnd: resultReserwation.dateEnd,
                      serviceName: resultReserwation.serviceName,
                      visitNotFinished: resultReserwation.visitNotFinished,
                      visitCanceled: resultReserwation.visitCanceled,
                      visitChanged: resultReserwation.visitChanged,
                      workerReserwation: resultReserwation.workerReserwation,
                      fullDate: resultReserwation.fullDate,
                    };

                    if (!!itemReserwation) {
                      io.getIO().emit(`user${resultReserwation.fromUser._id}`, {
                        action: "update-alerts",
                        alertData: {
                          reserwationId: itemReserwation,
                          active: true,
                          type: "reserwation_notifaction",
                          creationTime: new Date(),
                          companyChanged: true,
                        },
                      });

                      bulkArrayToUpdateUsers.push({
                        updateOne: {
                          filter: {
                            _id: resultReserwation.fromUser._id,
                          },
                          update: {
                            $inc: { alertActiveCount: 1 },
                            $push: {
                              alerts: {
                                $each: [userAlertToSave],
                                $position: 0,
                              },
                            },
                          },
                        },
                      });
                    }
                    if (!!resultReserwation.fromUser.email) {
                      transporter.sendMail({
                        to: resultReserwation.fromUser.email,
                        from: MAIL_INFO,
                        subject: `Przypomnienie o wizycie`,
                        html: `<h1>Przypomnienie o wizycie</h1>
                          Przypomnienie o wizycie która ma odbyć się: ${itemReserwation.dateDay}.${itemReserwation.dateMonth}.${itemReserwation.dateYear}, o godzinie: ${itemReserwation.dateStart}. Usługa: ${itemReserwation.serviceName}`,
                      });
                    }
                  }
                }
              }
            } else {
              if (!!resultReserwation.email) {
                transporter.sendMail({
                  to: resultReserwation.email,
                  from: MAIL_INFO,
                  subject: `Przypomnienie o wizycie`,
                  html: `<h1>Przypomnienie o wizycie</h1>
                          Przypomnienie o wizycie która ma odbyć się: ${itemReserwation.dateDay}.${itemReserwation.dateMonth}.${itemReserwation.dateYear}, o godzinie: ${itemReserwation.dateStart}. Usługa: ${itemReserwation.serviceName}`,
                });
              }
            }
          });
          if (bulkArrayToUpdateUsers.length > 0) {
            return User.bulkWrite(bulkArrayToUpdateUsers)
              .then(() => {
                return resultReserwations;
              })
              .catch(() => {
                const error = new Error(
                  "Błąd podczas dodawania alertów użytkownikom."
                );
                error.statusCode = 502;
                throw error;
              });
          } else {
            const error = new Error("Brak rezerwacji.");
            error.statusCode = 502;
            throw error;
          }
        })
        .then(async (resultReserwations) => {
          const filteredCompany = [];
          const bulkArrayToUpdateReserwations = [];
          resultReserwations.forEach((itemReserwation) => {
            if (!!itemReserwation.company) {
              if (!!itemReserwation.company.smsNotifactionAvaible) {
                const findIndexCompany = filteredCompany.findIndex(
                  (item) => item.companyId == itemReserwation.company._id
                );

                if (findIndexCompany >= 0) {
                  filteredCompany[findIndexCompany].allReserwations.push(
                    itemReserwation
                  );
                } else {
                  const newItem = {
                    companyId: itemReserwation.company._id,
                    companyEmail: itemReserwation.company.email,
                    allReserwations: [itemReserwation],
                  };
                  filteredCompany.push(newItem);
                }
              }
            }
          });

          for (const itemCompany of filteredCompany) {
            // filteredCompany.forEach(async (itemCompany) => {
            const resultFunctionUpdate = await updateCompanyFunction(
              itemCompany
            );
            if (!!resultFunctionUpdate) {
              for (const itemReserwation of itemCompany.allReserwations) {
                // itemCompany.allReserwations.forEach((itemReserwation) => {
                if (itemReserwation.fromUser) {
                  let selectedPhoneNumber = null;
                  if (!!itemReserwation.fromUser.phoneVerified) {
                    selectedPhoneNumber = itemReserwation.fromUser.phone;
                  } else {
                    if (!!itemReserwation.fromUser.whiteListVerifiedPhones) {
                      if (
                        itemReserwation.fromUser.whiteListVerifiedPhones
                          .length > 0
                      ) {
                        selectedPhoneNumber =
                          itemReserwation.fromUser.whiteListVerifiedPhones[
                            itemReserwation.fromUser.whiteListVerifiedPhones
                              .length - 1
                          ];
                      }
                    }
                  }
                  if (!!selectedPhoneNumber) {
                    bulkArrayToUpdateReserwations.push({
                      updateOne: {
                        filter: {
                          _id: itemReserwation._id,
                        },
                        update: {
                          $set: {
                            sendSMSNotifaction: true,
                          },
                        },
                      },
                    });

                    const userPhone = Buffer.from(
                      selectedPhoneNumber,
                      "base64"
                    ).toString("utf-8");

                    const validComapnyName =
                      itemReserwation.company.name.length > 32
                        ? itemReserwation.company.name.slice(0, 32)
                        : itemReserwation.company.name;

                    const messageNotifaction = `Przypomnienie o wizycie która ma odbyć się: ${itemReserwation.dateDay}.${itemReserwation.dateMonth}.${itemReserwation.dateYear}, o godzinie: ${itemReserwation.dateStart}. Usługa: ${itemReserwation.serviceName}`;

                    const params = {
                      Message: `${messageNotifaction} - ${validComapnyName.toUpperCase()}`,
                      MessageStructure: "string",
                      PhoneNumber: `+48${userPhone}`,
                      MessageAttributes: {
                        "AWS.SNS.SMS.SenderID": {
                          DataType: "String",
                          StringValue: "Meetsy",
                        },
                      },
                    };
                    sns.publish(params, function (err, data) {
                      if (err) console.log(err, err.stack);
                    });
                  }
                } else {
                  if (!!itemReserwation.phone) {
                    bulkArrayToUpdateReserwations.push({
                      updateOne: {
                        filter: {
                          _id: itemReserwation._id,
                        },
                        update: {
                          $set: {
                            sendSMSNotifaction: true,
                          },
                        },
                      },
                    });

                    const userPhone = Buffer.from(
                      itemReserwation.phone,
                      "base64"
                    ).toString("utf-8");

                    const validComapnyName =
                      itemReserwation.company.name.length > 32
                        ? itemReserwation.company.name.slice(0, 32)
                        : itemReserwation.company.name;

                    const messageNotifaction = `Przypomnienie o wizycie która ma odbyć się: ${itemReserwation.dateDay}.${itemReserwation.dateMonth}.${itemReserwation.dateYear}, o godzinie: ${itemReserwation.dateStart}. Usługa: ${itemReserwation.serviceName}`;

                    const params = {
                      Message: `${messageNotifaction} - ${validComapnyName.toUpperCase()}`,
                      MessageStructure: "string",
                      PhoneNumber: `+48${userPhone}`,
                      MessageAttributes: {
                        "AWS.SNS.SMS.SenderID": {
                          DataType: "String",
                          StringValue: "Meetsy",
                        },
                      },
                    };
                    sns.publish(params, function (err, data) {
                      if (err) console.log(err, err.stack);
                    });
                  }
                }
              }

              Reserwation.bulkWrite(bulkArrayToUpdateReserwations)
                .then(() => {})
                .catch(() => {
                  const error = new Error(
                    "Błąd podczas aktualizacji rezerwacji."
                  );
                  error.statusCode = 502;
                  throw error;
                });
            } else {
              transporter.sendMail({
                to: itemCompany.companyEmail,
                from: MAIL_INFO,
                subject:
                  "Brak środków na wysłanie sms-ów na potwierdzenie wizyty.",
                html: `<h1>Brak środków na wysłanie sms-ów na potwierdzenie wizyty</h1> Potrzebna ilość: ${itemCompany.allReserwations.length}`,
              });
            }
          }
        })
        .catch(() => {});
    }
  );

  //notification one day before communiting
  schedule.scheduleJob(
    `${i < 12 ? i * 5 : (i - 12) * 5} ${i < 12 ? 10 : 1 < 24 ? 11 : 12} * * *`,
    async () => {
      const validDate = new Date(new Date().setDate(new Date().getDate() + 1));
      const dateStartValid = new Date(
        validDate.getFullYear(),
        validDate.getMonth(),
        validDate.getDate(),
        i,
        0,
        0,
        0
      );
      const dateStartValidEnd = new Date(
        validDate.getFullYear(),
        validDate.getMonth(),
        validDate.getDate(),
        i,
        59,
        59,
        59
      );
      Communiting.find({
        year: validDate.getFullYear(),
        month: validDate.getMonth() + 1,
        day: validDate.getDate(),
        isDeleted: { $in: [false, null] },
        fullDate: {
          $gte: dateStartValid.toISOString(),
          $lte: dateStartValidEnd.toISOString(),
        },
      })
        .select(
          "_id city description userId companyId month year day timeStart timeEnd workerUserId phone email surname name"
        )
        .populate("companyId", "_id name linkPath notificationCommuniting")
        .populate("workerUserId", "_id name surname")
        .populate(
          "userId",
          "_id name surname whiteListVerifiedPhones phoneVerified email"
        )
        .then((resultCommunitings) => {
          const bulkArrayToUpdateUsers = [];
          resultCommunitings.forEach((resultCommuniting) => {
            if (!!resultCommuniting.userId) {
              let itemReserwation = null;
              if (!!resultCommuniting.userId._id) {
                if (!!resultCommuniting.workerUserId) {
                  if (
                    !!resultCommuniting.workerUserId._id &&
                    !!resultCommuniting.companyId._id
                  ) {
                    const userAlertToSave = {
                      reserwationId: resultCommuniting._id,
                      active: true,
                      type: "communiting_notifaction",
                      creationTime: new Date(),
                      companyChanged: true,
                    };

                    itemReserwation = {
                      _id: resultCommuniting._id,
                      userId: {
                        name: resultCommuniting.userId.name,
                        surname: resultCommuniting.userId.surname,
                        _id: resultCommuniting.userId._id,
                      },
                      companyId: {
                        name: resultCommuniting.companyId.name,
                        _id: resultCommuniting.companyId._id,
                        linkPath: resultCommuniting.companyId.linkPath,
                      },
                      workerUserId: {
                        name: resultCommuniting.workerUserId.name,
                        _id: resultCommuniting.workerUserId._id,
                        surname: resultCommuniting.workerUserId.surname,
                      },
                      year: resultCommuniting.dateYear,
                      month: resultCommuniting.dateMonth,
                      day: resultCommuniting.dateDay,
                      timeStart: resultCommuniting.dateStart,
                      fullDate: resultCommuniting.fullDate,
                      city: resultCommuniting.city,
                      street: resultCommuniting.street,
                      statusValue: resultCommuniting.statusValue,
                      cost: resultCommuniting.cost,
                      description: resultCommuniting.description,
                    };

                    if (!!itemReserwation) {
                      io.getIO().emit(`user${resultCommuniting.userId._id}`, {
                        action: "update-alerts",
                        alertData: {
                          reserwationId: itemReserwation,
                          active: true,
                          type: "communiting_notifaction",
                          creationTime: new Date(),
                          companyChanged: true,
                        },
                      });

                      bulkArrayToUpdateUsers.push({
                        updateOne: {
                          filter: {
                            _id: resultCommuniting.userId._id,
                          },
                          update: {
                            $inc: { alertActiveCount: 1 },
                            $push: {
                              alerts: {
                                $each: [userAlertToSave],
                                $position: 0,
                              },
                            },
                          },
                        },
                      });
                    }
                    if (
                      !!resultCommuniting.userId.email ||
                      !!resultCommuniting.email
                    ) {
                      transporter.sendMail({
                        to: !!resultCommuniting.userId.email
                          ? resultCommuniting.userId.email
                          : resultCommuniting.email,
                        from: MAIL_INFO,
                        subject: `Przypomnienie o dojeżdzie`,
                        html: `<h1>Przypomnienie o dojeżdzie</h1>
                          Przypomnienie o dojeżdzie która ma odbyć się: ${itemReserwation.day}.${itemReserwation.month}.${itemReserwation.year}, o godzinie: ${itemReserwation.timeStart}. Miasto: ${itemReserwation.city}`,
                      });
                    }
                  }
                }
              }
            }
          });
          if (bulkArrayToUpdateUsers.length > 0) {
            return User.bulkWrite(bulkArrayToUpdateUsers)
              .then(() => {
                return resultCommunitings;
              })
              .catch(() => {
                const error = new Error(
                  "Błąd podczas dodawania alertów użytkownikom."
                );
                error.statusCode = 502;
                throw error;
              });
          } else {
            const error = new Error("Brak rezerwacji.");
            error.statusCode = 502;
            throw error;
          }
        })
        .then(async (resultCommunitings) => {
          const filteredCompany = [];
          const bulkArrayToUpdateReserwations = [];
          resultCommunitings.forEach((itemReserwation) => {
            if (!!itemReserwation.companyId) {
              if (!!itemReserwation.companyId.notificationCommuniting) {
                const findIndexCompany = filteredCompany.findIndex(
                  (item) => item.companyId == itemReserwation.companyId._id
                );

                if (findIndexCompany >= 0) {
                  filteredCompany[findIndexCompany].allReserwations.push(
                    itemReserwation
                  );
                } else {
                  const newItem = {
                    companyId: itemReserwation.companyId._id,
                    companyEmail: itemReserwation.companyId.email,
                    allReserwations: [itemReserwation],
                  };
                  filteredCompany.push(newItem);
                }
              }
            }
          });

          for (const itemCompany of filteredCompany) {
            // filteredCompany.forEach(async (itemCompany) => {
            const resultFunctionUpdate = await updateCompanyFunction(
              itemCompany,
              "sms_notifaction_communiting"
            );
            if (!!resultFunctionUpdate) {
              for (const itemReserwation of itemCompany.allReserwations) {
                // itemCompany.allReserwations.forEach((itemReserwation) => {
                if (itemReserwation.userId) {
                  let selectedPhoneNumber = null;
                  if (!!itemReserwation.userId.phoneVerified) {
                    selectedPhoneNumber = itemReserwation.userId.phone;
                  } else {
                    if (!!itemReserwation.userId.whiteListVerifiedPhones) {
                      if (
                        itemReserwation.userId.whiteListVerifiedPhones.length >
                        0
                      ) {
                        selectedPhoneNumber =
                          itemReserwation.userId.whiteListVerifiedPhones[
                            itemReserwation.userId.whiteListVerifiedPhones
                              .length - 1
                          ];
                      }
                    }
                  }
                  if (!!selectedPhoneNumber) {
                    bulkArrayToUpdateReserwations.push({
                      updateOne: {
                        filter: {
                          _id: itemReserwation._id,
                        },
                        update: {
                          $set: {
                            notificationSMS: true,
                          },
                        },
                      },
                    });

                    const userPhone = Buffer.from(
                      selectedPhoneNumber,
                      "base64"
                    ).toString("utf-8");

                    const validComapnyName =
                      itemReserwation.companyId.name.length > 32
                        ? itemReserwation.companyId.name.slice(0, 32)
                        : itemReserwation.companyId.name;

                    const messageNotifaction = `Przypomnienie o wizycie która ma odbyć się: ${itemReserwation.day}.${itemReserwation.month}.${itemReserwation.year}, o godzinie: ${itemReserwation.timeStart}. Miasto: ${itemReserwation.city}`;

                    const params = {
                      Message: `${messageNotifaction} - ${validComapnyName.toUpperCase()}`,
                      MessageStructure: "string",
                      PhoneNumber: `+48${userPhone}`,
                      MessageAttributes: {
                        "AWS.SNS.SMS.SenderID": {
                          DataType: "String",
                          StringValue: "Meetsy",
                        },
                      },
                    };
                    // sns.publish(params, function (err, data) {
                    //   if (err) console.log(err, err.stack);
                    // });
                  }
                }
              }

              Communiting.bulkWrite(bulkArrayToUpdateReserwations)
                .then(() => {})
                .catch(() => {
                  const error = new Error(
                    "Błąd podczas aktualizacji rezerwacji."
                  );
                  error.statusCode = 502;
                  throw error;
                });
            } else {
              transporter.sendMail({
                to: itemCompany.companyEmail,
                from: MAIL_INFO,
                subject:
                  "Brak środków na wysłanie sms-ów na potwierdzenie wizyty.",
                html: `<h1>Brak środków na wysłanie sms-ów na potwierdzenie wizyty</h1> Potrzebna ilość: ${itemCompany.allReserwations.length}`,
              });
            }
          }
        })
        .catch(() => {});
    }
  );
}

schedule.scheduleJob(`10 8 * * *`, () => {
  Company.find({
    notifactionNoSMS: { $in: [false, null] },
    sms: {
      $lte: 50,
    },
  })
    .select("_id owner email notifactionNoSMS sms linkPath name")
    .then((companysSMSNotifaction) => {
      if (!!companysSMSNotifaction) {
        const bulkArrayToUpdateCompany = [];
        const bulkArrayToUpdateUsers = [];
        companysSMSNotifaction.forEach((itemCompany) => {
          bulkArrayToUpdateCompany.push({
            updateOne: {
              filter: {
                _id: itemCompany._id,
              },
              update: {
                $set: {
                  notifactionNoSMS: true,
                },
              },
            },
          });

          const itemAlert = {
            alertDefaultCompanyId: {
              _id: companysSMSNotifaction._id,
              name: companysSMSNotifaction.name,
              linkPath: companysSMSNotifaction.linkPath,
            },
            active: true,
            type: "alert_notifaction_sms",
            creationTime: new Date(),
            companyChanged: true,
          };

          const itemAlertPush = {
            alertDefaultCompanyId: companysSMSNotifaction._id,
            active: true,
            type: "alert_notifaction_sms",
            creationTime: new Date(),
            companyChanged: true,
          };

          io.getIO().emit(`user${itemCompany.owner}`, {
            action: "update-alerts",
            alertData: itemAlert,
          });

          bulkArrayToUpdateUsers.push({
            updateOne: {
              filter: {
                _id: itemCompany.owner,
              },
              update: {
                $inc: { alertActiveCount: 1 },
                $push: {
                  alerts: {
                    $each: [itemAlertPush],
                    $position: 0,
                  },
                },
              },
            },
          });

          transporter.sendMail({
            to: itemCompany.email,
            from: MAIL_INFO,
            subject: `Mała ilość SMS`,
            html: `Posiadasz małą ilość sms na koncie. Doładuj aby miec więcej`,
          });
        });

        Company.bulkWrite(bulkArrayToUpdateCompany)
          .then(() => {
            User.bulkWrite(bulkArrayToUpdateUsers)
              .then(() => {})
              .catch(() => {
                const error = new Error(
                  "Błąd podczas dodawania alertów użytkownikom."
                );
                error.statusCode = 502;
                throw error;
              });
          })
          .catch(() => {
            const error = new Error("Błąd podczas aktualizacji firmy.");
            error.statusCode = 502;
            throw error;
          });
      }
    })
    .catch(() => {});
});

schedule.scheduleJob(`20 8 * * *`, () => {
  const validDateToCheckPremium = new Date(
    new Date().setDate(new Date().getDate() + 3)
  );

  Company.find({
    notifactionNoPremium: { $in: [false, null] },
    premium: {
      $lte: validDateToCheckPremium,
    },
  })
    .select("_id name owner email notifactionNoPremium premium linkPath")
    .then((companysSMSNotifaction) => {
      if (!!companysSMSNotifaction) {
        const bulkArrayToUpdateCompany = [];
        const bulkArrayToUpdateUsers = [];
        companysSMSNotifaction.forEach((itemCompany) => {
          bulkArrayToUpdateCompany.push({
            updateOne: {
              filter: {
                _id: itemCompany._id,
              },
              update: {
                $set: {
                  notifactionNoPremium: true,
                },
              },
            },
          });
          const itemAlert = {
            alertDefaultCompanyId: {
              _id: companysSMSNotifaction._id,
              name: companysSMSNotifaction.name,
              linkPath: companysSMSNotifaction.linkPath,
            },
            active: true,
            type: "alert_notifaction_premium",
            creationTime: new Date(),
            companyChanged: true,
          };

          const itemAlertPush = {
            alertDefaultCompanyId: companysSMSNotifaction._id,
            active: true,
            type: "alert_notifaction_premium",
            creationTime: new Date(),
            companyChanged: true,
          };

          io.getIO().emit(`user${itemCompany.owner}`, {
            action: "update-alerts",
            alertData: itemAlert,
          });

          bulkArrayToUpdateUsers.push({
            updateOne: {
              filter: {
                _id: itemCompany.owner,
              },
              update: {
                $inc: { alertActiveCount: 1 },
                $push: {
                  alerts: {
                    $each: [itemAlertPush],
                    $position: 0,
                  },
                },
              },
            },
          });

          transporter.sendMail({
            to: itemCompany.email,
            from: MAIL_INFO,
            subject: `Twoje konto premium niedługo wygaśnie`,
            html: `Pozostało mniej niz 3 dni konta premium. Doładuj konto aby móc korzystać dłużej z meetsy`,
          });
        });

        Company.bulkWrite(bulkArrayToUpdateCompany)
          .then(() => {
            User.bulkWrite(bulkArrayToUpdateUsers)
              .then(() => {})
              .catch(() => {
                const error = new Error(
                  "Błąd podczas dodawania alertów użytkownikom."
                );
                error.statusCode = 502;
                throw error;
              });
          })
          .catch(() => {
            const error = new Error("Błąd podczas aktualizacji firmy.");
            error.statusCode = 502;
            throw error;
          });
      }
    })
    .catch(() => {});
});

const handleUpdateInvoiceToS3 = async (
  dateInvoice,
  companyId,
  invoiceId,
  newInvoice
) => {
  try {
    const result = await s3Bucket
      .upload({
        Key: `invoices/${dateInvoice.getFullYear()}/${
          dateInvoice.getMonth() + 1
        }/${dateInvoice.getDate()}/${companyId}_${invoiceId}`,
        Body: newInvoice,
        ContentType: "application/pdf; charset=utf-8",
        ACL: "public-read",
      })
      .promise()
      .then((result) => {
        return result.key;
      });
    if (!!result) {
      return result;
    } else {
      return false;
    }
  } catch {
    return false;
  }
};

schedule.scheduleJob(`5 3 * * *`, async () => {
  const actualDate = new Date();
  Invoice.find({
    year: actualDate.getFullYear(),
    month: actualDate.getMonth() + 1,
    day: actualDate.getDate() - 1,
    link: null,
  })
    .populate(
      "companyId",
      "_id email name city district adress code nip dataToInvoice"
    )
    .then(async (newInvoices) => {
      const bulkArrayToUpdateInvoices = [];
      for (const [indexInvoice, resultNewInvoice] of newInvoices.entries()) {
        if (!!resultNewInvoice.companyId._id) {
          const unhashedAdress = Buffer.from(
            resultNewInvoice.companyId.adress,
            "base64"
          ).toString("utf-8");
          let shipingCompanyDate = {};
          if (!!resultNewInvoice.companyId.dataToInvoice) {
            shipingCompanyDate = {
              name: resultNewInvoice.companyId.dataToInvoice.name,
              address: resultNewInvoice.companyId.dataToInvoice.street,
              code: resultNewInvoice.companyId.dataToInvoice.postalCode,
              city: resultNewInvoice.companyId.dataToInvoice.city,
              nip: !!resultNewInvoice.companyId.nip
                ? resultNewInvoice.companyId.nip
                : "000000000",
            };
          } else {
            shipingCompanyDate = {
              name: resultNewInvoice.companyId.name,
              address: unhashedAdress,
              code: !!resultNewInvoice.companyId.code
                ? resultNewInvoice.companyId.code
                : "00-000",
              city: resultNewInvoice.companyId.city,
              nip: !!resultNewInvoice.companyId.nip
                ? resultNewInvoice.companyId.nip
                : "000000000",
            };
          }
          const mapBoughtItems = resultNewInvoice.productsInfo.map(
            (boughtItem) => {
              return {
                name: boughtItem.name,
                count: 1,
                price: boughtItem.price,
              };
            }
          );
          const invoiceData = {
            dealer: {
              name: "FROFRONT Hubert Mazur",
              address: "Struga 18",
              code: "26-600",
              city: "Radom",
              nip: "799999999",
            },
            shipping: {
              name: resultNewInvoice.companyId.name,
              address: unhashedAdress,
              code: !!resultNewInvoice.companyId.code
                ? resultNewInvoice.companyId.code
                : "00-000",
              city: resultNewInvoice.companyId.city,
              nip: !!resultNewInvoice.companyId.nip
                ? resultNewInvoice.companyId.nip
                : "000000000",
            },
            items: mapBoughtItems,
          };
          const newInvoice = createInvoice(
            invoiceData,
            indexInvoice + 1,
            new Date()
          );
          const resultUpload = await handleUpdateInvoiceToS3(
            actualDate,
            resultNewInvoice.companyId._id,
            resultNewInvoice._id,
            newInvoice
          );
          if (!!resultUpload) {
            bulkArrayToUpdateInvoices.push({
              updateOne: {
                filter: {
                  _id: resultNewInvoice._id,
                },
                update: {
                  $set: {
                    link: resultUpload,
                    invoiceNumber: indexInvoice + 1,
                  },
                },
              },
            });
          }
        }
      }
      Invoice.bulkWrite(bulkArrayToUpdateInvoices)
        .then(() => {})
        .catch(() => {
          const error = new Error("Błąd podczas aktualizacji zamówień.");
          error.statusCode = 422;
          throw error;
        });
    });
});

schedule.scheduleJob(`5 8 * * *`, async () => {
  const actualDate = new Date();
  Invoice.find({
    year: actualDate.getFullYear(),
    month: actualDate.getMonth() + 1,
    day: actualDate.getDate() - 1,
    link: { $ne: null },
  })
    .populate("companyId", "_id email")
    .then(async (allInvoices) => {
      for (const resultInvoice of allInvoices) {
        const options = {
          Key: resultInvoice.link,
        };
        await s3Bucket.getObject(options, (err, data) => {
          if (!err) {
            transporter.sendMail({
              to: resultInvoice.companyId.email,
              from: MAIL_INFO,
              subject: "Faktura vat za dokonany zakup",
              html: `<h1>Witamy</h1>
                    Przesyłamy w załączniku fakture vat za dokonane zakupy!
            `,
              attachments: [
                {
                  content: data.Body,
                  contentType: "application/pdf",
                },
              ],
            });
          } else {
            const error = new Error("Błąd podczas pobierania faktury.");
            error.statusCode = 425;
            throw error;
          }
        });
      }
    });
});

exports.startShedule = () => {};
