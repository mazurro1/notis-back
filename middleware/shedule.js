const schedule = require("node-schedule");
const Reserwation = require("../models/reserwation");
const Company = require("../models/company");
const User = require("../models/user");
const nodemailer = require("nodemailer");
const io = require("../socket");
const AWS = require("aws-sdk");
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

const sns = new AWS.SNS();

const updateCompanyFunction = async (itemCompany) => {
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
            title: "sms_notifaction_reserwation",
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

for (let i = 0; i < 24; i++) {
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
      })
        .select(
          "_id fromUser dateYear dateMonth dateDay toWorkerUserId serviceName dateStart dateEnd visitNotFinished visitCanceled visitChanged workerReserwation fullDate"
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
          console.log(resultReserwations);
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
                      type: "rezerwation_notifaction",
                      creationTime: new Date(),
                      companyChanged: false,
                    };

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
                          type: "rezerwation_notifaction",
                          creationTime: new Date(),
                          companyChanged: false,
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
          filteredCompany.forEach(async (itemCompany) => {
            const resultFunctionUpdate = await updateCompanyFunction(
              itemCompany
            );
            if (!!resultFunctionUpdate) {
              itemCompany.allReserwations.forEach((itemReserwation) => {
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
                    ).toString("ascii");

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
                    // sns.publish(params, function (err, data) {
                    //   if (err) console.log(err, err.stack);
                    // });
                  }
                }
              });

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
          });
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
    .select("_id owner email notifactionNoSMS sms")
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
            reserwationId: null,
            active: true,
            type: "alert_notifaction_sms",
            creationTime: new Date(),
            companyChanged: false,
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
                    $each: [itemAlert],
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
    .select("_id owner email notifactionNoPremium premium")
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
            reserwationId: null,
            active: true,
            type: "alert_notifaction_premium",
            creationTime: new Date(),
            companyChanged: false,
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
                    $each: [itemAlert],
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

exports.startShedule = () => {};
