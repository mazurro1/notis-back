const schedule = require("node-schedule");
const Company = require("../models/company");
const AWS = require("aws-sdk");
const Invoice = require("../models/invoice");
const { createInvoice } = require("../generateInvoice");
const notifications = require("../middleware/notifications");
const generateEmail = require("./generateContentEmail");
const Alert = require("../models/alert");

require("dotenv").config();
const {
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  AWS_BUCKET,
} = process.env;

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

//reserwation
for (let i = 0; i < 24; i++) {
  schedule.scheduleJob(
    `${i < 12 ? i * 5 : (i - 12) * 5} ${i < 12 ? 10 : 1 < 24 ? 11 : 12} * * *`,
    // `56 12 * * *`,
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

      await notifications.updateAllCollection({
        companyField: "company",
        collection: "Reserwation",
        collectionItems:
          "_id serviceName fromUser toWorkerUserId company isDeleted oldReserwationId hasCommuniting dateYear dateMonth dateDay dateStart dateEnd fullDate costReserwation extraCost extraTime timeReserwation workerReserwation visitNotFinished visitCanceled visitChanged reserwationMessage serviceId activePromotion activeHappyHour activeStamp basicPrice opinionId isDraft sendSMSReserwation sendSMSReserwationUserChanged sendSMSNotifaction sendSMSCanceled sendSMSChanged communitingId",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: {},
        filtersCollection: {
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
          hasCommuniting: { $in: [false, null] },
        },
        userField: "fromUser",
        workerField: "toWorkerUserId",
        sendEmailValid: true,
        notificationContent: {
          typeAlert: "reserwationId",
          avaibleSendAlertToWorker: false,
        },
        smsContent: {
          companySendSMSValidField: "smsNotifactionAvaible",
          titleCompanySMSAlert: "sms_notification_reserwation",
          collectionFieldSMSOnSuccess: {
            sendSMSNotifaction: true,
          },
        },
        companyChanged: true,
        typeNotification: "reserwation_notifaction",
        deleteOpinion: false,
      });
    }
  );

  //notification one day before communiting
  schedule.scheduleJob(
    `${i < 12 ? i * 5 : (i - 12) * 5} ${i < 12 ? 10 : 1 < 24 ? 11 : 12} * * *`,
    // `37 13 * * *`,
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

      await notifications.updateAllCollection({
        companyField: "companyId",
        collection: "Communiting",
        collectionItems:
          "_id cost city description userId opinionId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd fullDate statusValue city street dateStartValid dateCommunitingValid isDeleted reserwationId",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: {},
        filtersCollection: {
          year: validDate.getFullYear(),
          month: validDate.getMonth() + 1,
          day: validDate.getDate(),
          isDeleted: { $in: [false, null] },
          fullDate: {
            $gte: dateStartValid.toISOString(),
            $lte: dateStartValidEnd.toISOString(),
          },
        },
        userField: "userId",
        workerField: "workerUserId",
        sendEmailValid: true,
        notificationContent: {
          typeAlert: "communitingId",
          avaibleSendAlertToWorker: false,
        },
        smsContent: {
          companySendSMSValidField: "smsCommunitingNotificationAvaible",
          titleCompanySMSAlert: "sms_notifaction_communiting",
          collectionFieldSMSOnSuccess: {
            notificationSMS: true,
          },
        },
        companyChanged: true,
        typeNotification: "commuting_notifaction",
        deleteOpinion: false,
      });
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
    .populate(
      "owner",
      "_id vapidEndpoint language name surname phoneVerified whiteListVerifiedPhones phone"
    )
    .then(async (companysSMSNotifaction) => {
      if (!!companysSMSNotifaction) {
        const bulkArrayToUpdateCompany = [];
        let alertsToUpdate = [];
        for (const itemCompany of companysSMSNotifaction) {
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

          if (!!itemCompany.owner) {
            const propsGenerator = generateEmail.generateContentEmail({
              alertType: "alert_notifaction_sms",
              companyChanged: true,
              language: !!itemCompany.owner.language
                ? itemCompany.owner.language
                : "PL",
              itemAlert: itemCompany,
              collection: "Company",
            });

            alertsToUpdate = notifications.sendMultiAlert({
              typeAlert: "alertDefaultCompanyId",
              typeNotification: "alert_notifaction_sms",
              workerUserField: "owner",
              usersResultWithItems: [
                {
                  language: itemCompany.owner.language,
                  vapidEndpoint: itemCompany.owner.vapidEndpoint,
                  items: [itemCompany],
                  owner: itemCompany.owner._id,
                },
              ],
              avaibleSendAlertToWorker: false,
              payload: {
                collection: "Company",
              },
              companyChanged: true,
              userField: "owner",
              returnItemsToUpdate: true,
            });

            let selectedPhoneNumber = null;
            if (!!itemCompany.owner.phoneVerified) {
              selectedPhoneNumber = itemCompany.owner.phone;
            } else {
              if (!!itemCompany.owner.whiteListVerifiedPhones) {
                if (itemCompany.owner.whiteListVerifiedPhones.length > 0) {
                  selectedPhoneNumber =
                    itemCompany.owner.whiteListVerifiedPhones[
                      itemCompany.owner.whiteListVerifiedPhones.length - 1
                    ];
                }
              }
            }

            if (!!selectedPhoneNumber) {
              const userPhone = Buffer.from(
                selectedPhoneNumber,
                "base64"
              ).toString("utf-8");

              const bodySMS = `${
                !!propsGenerator.title ? propsGenerator.title : ""
              } ${
                !!propsGenerator.day
                  ? `${propsGenerator.dayText}: ${propsGenerator.day}`
                  : ""
              } ${
                !!propsGenerator.hours
                  ? `${propsGenerator.hoursText}: ${propsGenerator.hours}`
                  : ""
              } ${
                !!propsGenerator.reserwation
                  ? `${propsGenerator.reserwationText}: ${propsGenerator.reserwation}`
                  : ""
              } ${
                !!propsGenerator.service
                  ? `${propsGenerator.serviceText}: ${propsGenerator.service}`
                  : ""
              } ${
                !!propsGenerator.communiting
                  ? `${propsGenerator.communitingText}: ${propsGenerator.communiting}`
                  : ""
              } ${
                !!propsGenerator.defaultText ? propsGenerator.defaultText : ""
              }`;

              //send to user sms
              await notifications.sendVerifySMS({
                phoneNumber: userPhone,
                message: bodySMS,
              });
            }

            notifications.sendEmail({
              email: itemCompany.email,
              ...propsGenerator,
            });
          }
        }

        Company.bulkWrite(bulkArrayToUpdateCompany)
          .then(() => {
            Alert.insertMany(alertsToUpdate)
              .then(() => {})
              .catch((err) => {
                const error = new Error(err);
                error.statusCode = 422;
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
    .catch((err) => {
      const error = new Error(err);
      error.statusCode = 502;
      throw error;
    });
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
    .populate(
      "owner",
      "_id vapidEndpoint language name surname phoneVerified whiteListVerifiedPhones phone"
    )
    .then(async (companysSMSNotifaction) => {
      if (!!companysSMSNotifaction) {
        const bulkArrayToUpdateCompany = [];
        let alertsToUpdate = [];
        for (const itemCompany of companysSMSNotifaction) {
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

          if (!!itemCompany.owner) {
            const propsGenerator = generateEmail.generateContentEmail({
              alertType: "alert_notifaction_premium",
              companyChanged: true,
              language: !!itemCompany.owner.language
                ? itemCompany.owner.language
                : "PL",
              itemAlert: itemCompany,
              collection: "Company",
            });

            alertsToUpdate = notifications.sendMultiAlert({
              typeAlert: "alertDefaultCompanyId",
              typeNotification: "alert_notifaction_premium",
              workerUserField: "owner",
              usersResultWithItems: [
                {
                  language: itemCompany.owner.language,
                  vapidEndpoint: itemCompany.owner.vapidEndpoint,
                  items: [itemCompany],
                  owner: itemCompany.owner._id,
                },
              ],
              avaibleSendAlertToWorker: false,
              payload: {
                collection: "Company",
              },
              companyChanged: true,
              userField: "owner",
              returnItemsToUpdate: true,
            });

            let selectedPhoneNumber = null;
            if (!!itemCompany.owner.phoneVerified) {
              selectedPhoneNumber = itemCompany.owner.phone;
            } else {
              if (!!itemCompany.owner.whiteListVerifiedPhones) {
                if (itemCompany.owner.whiteListVerifiedPhones.length > 0) {
                  selectedPhoneNumber =
                    itemCompany.owner.whiteListVerifiedPhones[
                      itemCompany.owner.whiteListVerifiedPhones.length - 1
                    ];
                }
              }
            }

            if (!!selectedPhoneNumber) {
              const userPhone = Buffer.from(
                selectedPhoneNumber,
                "base64"
              ).toString("utf-8");

              const bodySMS = `${
                !!propsGenerator.title ? propsGenerator.title : ""
              } ${
                !!propsGenerator.day
                  ? `${propsGenerator.dayText}: ${propsGenerator.day}`
                  : ""
              } ${
                !!propsGenerator.hours
                  ? `${propsGenerator.hoursText}: ${propsGenerator.hours}`
                  : ""
              } ${
                !!propsGenerator.reserwation
                  ? `${propsGenerator.reserwationText}: ${propsGenerator.reserwation}`
                  : ""
              } ${
                !!propsGenerator.service
                  ? `${propsGenerator.serviceText}: ${propsGenerator.service}`
                  : ""
              } ${
                !!propsGenerator.communiting
                  ? `${propsGenerator.communitingText}: ${propsGenerator.communiting}`
                  : ""
              } ${
                !!propsGenerator.defaultText ? propsGenerator.defaultText : ""
              }`;

              //send to user sms
              await notifications.sendVerifySMS({
                phoneNumber: userPhone,
                message: bodySMS,
              });
            }

            notifications.sendEmail({
              email: itemCompany.email,
              ...propsGenerator,
            });
          }
        }

        Company.bulkWrite(bulkArrayToUpdateCompany)
          .then(() => {
            Alert.insertMany(alertsToUpdate)
              .then(() => {})
              .catch((err) => {
                const error = new Error(err);
                error.statusCode = 422;
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
            const propsGenerator = generateEmail.generateContentEmail({
              alertType: "alert_invoice",
              companyChanged: true,
              language: "PL",
              itemAlert: null,
              collection: "Default",
            });

            notifications.sendEmail({
              email: resultInvoice.companyId.email,
              ...propsGenerator,
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
