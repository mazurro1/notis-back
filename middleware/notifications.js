const User = require("../models/user");
const Alert = require("../models/alert");
const Company = require("../models/company");
const Service = require("../models/service");
const Communiting = require("../models/Communiting");
const Reserwation = require("../models/reserwation");
const webpush = require("web-push");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const io = require("../socket");
const ejs = require("ejs");
const generateEmail = require("./generateContentEmail");

require("dotenv").config();
const {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_INFO,
  MAIL_PASSWORD,
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  PUBLIC_KEY_VAPID,
  PRIVATE_KEY_VAPID,
} = process.env;

webpush.setVapidDetails(
  `mailto:${MAIL_INFO}`,
  PUBLIC_KEY_VAPID,
  PRIVATE_KEY_VAPID
);

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

const sns = new AWS.SNS({
  MessageAttributes: {
    "AWS.SNS.SMS.SenderID": {
      DataType: "String",
      StringValue: "Meetsy",
    },
    "AWS.SNS.SMS.SMSType": {
      DataType: "String",
      StringValue: "Transactional",
    },
    "AWS.SNS.SMS.MaxPrice": {
      DataType: "String",
      StringValue: "0.04",
    },
  },
  MessageStructure: "string",
  apiVersion: "2010-03-31",
});

const sendAlert = ({
  typeAlert = "reserwationId",
  dateAlert = {
    _id: "605f2e95d5c855511465d486",
  },
  typeNotification = "reserwation_created",
  usersResult = [],
  payload = {
    title: "",
    body: "",
    icon: "",
  },
  companyChanged = true,
}) => {
  const newInserItems = [];
  let newAlertData = null;

  for (const userDoc of usersResult) {
    if (!!dateAlert && !!typeNotification && !!typeAlert) {
      newAlertData = {
        [typeAlert]: dateAlert._id,
        active: true,
        type: typeNotification,
        creationTime: new Date(),
        companyChanged: companyChanged,
        toUserId: userDoc._id,
      };

      io.getIO().emit(`user${userDoc._id}`, {
        action: "update-alerts",
        alertData: {
          [typeAlert]: dateAlert,
          active: true,
          type: typeNotification,
          creationTime: new Date(),
          companyChanged: companyChanged,
        },
      });
    }
    if (!!newAlertData) {
      newInserItems.push(newAlertData);
    }

    if (!!payload) {
      if (!!userDoc.vapidEndpoint && !!payload.title && !!payload.body) {
        webpush
          .sendNotification(userDoc.vapidEndpoint, JSON.stringify(payload))
          .then(() => {})
          .catch(() => {});
      }
    }
  }
  if (newInserItems.length > 0) {
    Alert.insertMany(newInserItems)
      .then(() => {})
      .catch(() => {
        const error = new Error("Błąd podczas aktualizacji powiadomień.");
        error.statusCode = 422;
        throw error;
      });
  }
};

const sendMultiAlert = ({
  typeAlert = "reserwationId",
  typeNotification = "reserwation_created",
  workerUserField = "",
  usersResultWithItems = [],
  avaibleSendAlertToWorker = false,
  payload = {
    title: "",
    body: "",
    icon: "",
  },
  companyChanged = true,
  userField = "",
}) => {
  const newInserItems = [];
  for (const userDoc of usersResultWithItems) {
    for (const userItem of userDoc.items) {
      if (!!typeNotification && !!typeAlert) {
        const newAlertDataUser = {
          [typeAlert]: userItem._id,
          active: true,
          type: typeNotification,
          creationTime: new Date(),
          companyChanged: companyChanged,
          toUserId: userDoc[userField],
        };
        newInserItems.push(newAlertDataUser);

        io.getIO().emit(`user${userDoc[userField]}`, {
          action: "update-alerts",
          alertData: {
            [typeAlert]: userItem,
            active: true,
            type: typeNotification,
            creationTime: new Date(),
            companyChanged: companyChanged,
          },
        });

        if (!!avaibleSendAlertToWorker && !!workerUserField) {
          const newAlertDataWorker = {
            [typeAlert]: userItem._id,
            active: true,
            type: typeNotification,
            creationTime: new Date(),
            companyChanged: companyChanged,
            toUserId: userItem[workerUserField],
          };
          io.getIO().emit(`user${userItem[workerUserField]}`, {
            action: "update-alerts",
            alertData: {
              [typeAlert]: userItem,
              active: true,
              type: typeNotification,
              creationTime: new Date(),
              companyChanged: companyChanged,
            },
          });
          newInserItems.push(newAlertDataWorker);
        }
      }

      if (!!payload) {
        if (!!userDoc.vapidEndpoint && !!payload.title && !!payload.body) {
          webpush
            .sendNotification(userDoc.vapidEndpoint, JSON.stringify(payload))
            .then(() => {})
            .catch(() => {});
        }
      }
    }
  }
  if (newInserItems.length > 0) {
    Alert.insertMany(newInserItems)
      .then(() => {})
      .catch(() => {
        const error = new Error("Błąd podczas aktualizacji powiadomień.");
        error.statusCode = 422;
        throw error;
      });
  }
};

const sendEmail = async ({
  email,
  attachments = null,
  title,
  alertColor,
  day = null,
  hours = null,
  reserwation = null,
  service = null,
  communiting = null,
  alertDate,
  timeStartEnd,
  companyLink,
  dayText,
  hoursText,
  reserwationText,
  serviceText,
  communitingText,
  defaultText = null,
}) => {
  if (
    !!email &&
    !!title &&
    (!!defaultText ||
      !!reserwation ||
      !!service ||
      !!communiting ||
      !!hours ||
      !!day)
  ) {
    ejs.renderFile(
      __dirname + "/mailTemplate.ejs",
      {
        title: title,
        alertColor: alertColor,
        day: day,
        hours: hours,
        reserwation: reserwation,
        service: service,
        communiting: communiting,
        alertDate: alertDate,
        timeStartEnd: timeStartEnd,
        companyLink: companyLink,
        dayText: dayText,
        hoursText: hoursText,
        reserwationText: reserwationText,
        serviceText: serviceText,
        communitingText: communitingText,
        defaultText: defaultText,
      },
      (err, data) => {
        if (!err) {
          const validAttachments = !!attachments ? attachments : {};
          transporter.sendMail({
            to: email,
            from: MAIL_INFO,
            subject: title,
            html: data,
            ...validAttachments,
          });
        } else {
          throw new Error(err);
        }
      }
    );
  }
};

const sendVerifySMS = ({ phoneNumber = null, message = null }) => {
  if (!!phoneNumber && !!message) {
    const params = {
      Message: message,
      PhoneNumber: `+48${phoneNumber}`,
      // PhoneNumber: `+48515873009`,
    };

    return sns
      .publish(params)
      .promise()
      .then((data) => {
        if (!!data) {
          return data.MessageId;
        } else {
          return false;
        }
      })
      .catch(() => {
        return false;
      });
  } else {
    return false;
  }
};

const sendSMS = ({
  userId,
  companyId,
  companySendSMSValidField,
  titleCompanySendSMS,
  message,
  customPhone,
}) => {
  let snsResult = false;
  let snsResultCustom = false;
  if (!!customPhone) {
    return Company.updateOne(
      {
        _id: companyId,
        sms: { $gt: 0 },
        [companySendSMSValidField]: {
          $exists: true,
          $ne: null,
          $in: [true],
        },
      },
      {
        $inc: {
          sms: -1,
        },
        $addToSet: {
          raportSMS: {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            count: 1,
            isAdd: false,
            title: titleCompanySendSMS,
          },
        },
      },
      { upsert: true, safe: true },
      null
    )
      .then((updated) => {
        const params = {
          Message: message,
          PhoneNumber: `+48${customPhone}`,
          // PhoneNumber: `+48515873009`,
        };

        return sns
          .publish(params)
          .promise()
          .then((data) => {
            if (!!data) {
              return data.MessageId;
            } else {
              return snsResultCustom;
            }
          })
          .catch(() => {
            return snsResultCustom;
          });
      })
      .catch((err) => {
        return snsResultCustom;
      });
  } else if (!!userId) {
    return User.findOne({
      _id: userId,
      accountVerified: true,
    })
      .select("_id phoneVerified phone whiteListVerifiedPhones")
      .then((userDoc) => {
        if (!!userDoc) {
          if (
            !!companyId &&
            !!companySendSMSValidField &&
            !!titleCompanySendSMS &&
            message
          ) {
            let selectedPhoneNumber = null;
            if (!!userDoc.phoneVerified) {
              selectedPhoneNumber = userDoc.phone;
            } else {
              if (!!userDoc.whiteListVerifiedPhones) {
                if (userDoc.whiteListVerifiedPhones.length > 0) {
                  selectedPhoneNumber =
                    userDoc.whiteListVerifiedPhones[
                      userDoc.whiteListVerifiedPhones.length - 1
                    ];
                }
              }
            }

            if (!!selectedPhoneNumber) {
              const userPhone = Buffer.from(
                selectedPhoneNumber,
                "base64"
              ).toString("utf-8");
              return Company.updateOne(
                {
                  _id: companyId,
                  sms: { $gt: 0 },
                  [companySendSMSValidField]: {
                    $exists: true,
                    $ne: null,
                    $in: [true],
                  },
                },
                {
                  $inc: {
                    sms: -1,
                  },
                  $addToSet: {
                    raportSMS: {
                      year: new Date().getFullYear(),
                      month: new Date().getMonth() + 1,
                      count: 1,
                      isAdd: false,
                      title: titleCompanySendSMS,
                    },
                  },
                },
                { upsert: true, safe: true },
                null
              )
                .then(() => {
                  const params = {
                    Message: message,
                    PhoneNumber: `+48${userPhone}`,
                    // PhoneNumber: `+48515873009`,
                  };

                  return sns
                    .publish(params)
                    .promise()
                    .then((data) => {
                      if (!!data) {
                        return data.MessageId;
                      } else {
                        return false;
                      }
                    })
                    .catch(() => {
                      return false;
                    });
                })
                .catch((err) => {
                  return snsResult;
                });
            } else {
              return snsResult;
            }
          } else {
            return snsResult;
          }
        } else {
          return snsResult;
        }
      })
      .catch((err) => {
        return snsResult;
      });
  }
};

const sendAll = async ({
  usersId = [],
  clientId = null,
  emailContent = { customEmail: null, emailTitle: "", emailMessage: "" },
  notificationContent = {
    typeAlert: "",
    dateAlert: {
      _id: "",
    },
    typeNotification: "",
    usersResult: [],
    payload: {
      title: "",
      body: "",
      icon: "",
    },
    companyChanged: true,
  },
  smsContent = {
    companyId: null,
    customPhone: null,
    companySendSMSValidField: null,
    titleCompanySendSMS: "",
    message: "",
  },
}) => {
  let resultSMS = null;
  if (!!emailContent) {
    if (
      !!emailContent.customEmail &&
      !!emailContent.emailTitle &&
      !!emailContent.emailMessage
    ) {
      sendEmail({
        email: emailContent.customEmail,
        emailTitle: emailContent.emailTitle,
        emailMessage: emailContent.emailMessage,
      });
    }
  }

  if (!!smsContent) {
    if (
      !!smsContent.customPhone &&
      !!smsContent.companyId &&
      !!smsContent.companySendSMSValidField &&
      !!smsContent.message
    ) {
      resultSMS = await sendSMS({
        userId: null,
        customPhone: smsContent.customPhone,
        companyId: smsContent.companyId,
        companySendSMSValidField: smsContent.companySendSMSValidField,
        titleCompanySendSMS: smsContent.titleCompanySendSMS,
        message: smsContent.message,
      });
    }
  }

  if (usersId.length > 0) {
    return User.find({
      _id: { $in: usersId },
    })
      .select(
        "_id email phoneVerified phone whiteListVerifiedPhones vapidEndpoint accountVerified language"
      )
      .then(async (users) => {
        let client = null;
        if (!!clientId) {
          client = users.find(
            (user) => user._id.toString() == clientId.toString()
          );
        }
        if (!!client) {
          if (!!emailContent) {
            if (
              !!client.email &&
              !!emailContent.emailTitle &&
              !!emailContent.emailMessage &&
              !!!emailContent.customEmail
            ) {
              sendEmail({
                email: client.email,
                emailTitle: emailContent.emailTitle,
                emailMessage: emailContent.emailMessage,
              });
            }
          }

          if (!!smsContent) {
            if (
              !!smsContent.companyId &&
              !!smsContent.companySendSMSValidField &&
              !!smsContent.message &&
              !!!smsContent.customPhone
            ) {
              resultSMS = await sendSMS({
                userId: client._id,
                companyId: smsContent.companyId,
                companySendSMSValidField: smsContent.companySendSMSValidField,
                titleCompanySendSMS: smsContent.titleCompanySendSMS,
                message: smsContent.message,
              });
            }
          }
        }
        if (!!notificationContent) {
          if (
            !!notificationContent.typeAlert &&
            !!notificationContent.dateAlert &&
            !!notificationContent.typeNotification
          )
            sendAlert({
              typeAlert: notificationContent.typeAlert,
              dateAlert: notificationContent.dateAlert,
              typeNotification: notificationContent.typeNotification,
              usersResult: users,
              payload: notificationContent.payload,
              companyChanged: notificationContent.companyChanged,
            });
        }
        return { resultSMS: resultSMS };
      });
  } else {
    return { resultSMS: resultSMS };
  }
};

const updateCompanyFunction = async ({
  companyId = null,
  countItems = 0,
  titleCompanySendSMSAlert = null,
  smsCompanyFieldValid = null,
}) => {
  if (
    !!companyId &&
    countItems > 0 &&
    !!titleCompanySendSMSAlert &&
    !!smsCompanyFieldValid
  ) {
    try {
      const result = await Company.updateOne(
        {
          _id: companyId,
          sms: { $gte: countItems },
          [smsCompanyFieldValid]: true,
        },
        {
          $inc: {
            sms: -countItems,
          },
          $addToSet: {
            raportSMS: {
              year: new Date().getFullYear(),
              month: new Date().getMonth() + 1,
              count: countItems,
              isAdd: false,
              title: titleCompanySendSMSAlert,
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
  } else {
    return false;
  }
};

const updateAllCollection = async ({
  companyId = null,
  companyField = "",
  filtersCollection = null,
  collection = "",
  collectionItems = "",
  extraCollectionPhoneField = "",
  extraCollectionEmailField = "",
  extraCollectionNameField = "",
  userField = "",
  workerField = "",
  updateCollectionItemObject = null,
  emailContent = {
    emailTitle: "Odwołano wizyte w firmie",
    emailMessage: "Odwołano wizytę w firmie",
  },
  notificationContent = {
    typeAlert: "",
    typeNotification: "",
    payload: {
      title: "",
      body: "",
      icon: "",
    },
  },
  smsContent = {
    companySendSMSValidField: null,
    titleCompanySendSMS: "",
    titleCompanySMSAlert: "",
    message: "",
  },
  companyChanged = false,
}) => {
  const selectedCollection =
    collection === "Communiting"
      ? Communiting
      : collection === "Service"
      ? Service
      : collection === "Reserwation"
      ? Reserwation
      : null;
  if (
    !!selectedCollection &&
    !!workerField &&
    !!userField &&
    !!collectionItems &&
    !!filtersCollection &&
    !!companyId &&
    !!updateCollectionItemObject &&
    !!companyField
  ) {
    return selectedCollection
      .find(filtersCollection)
      .select(
        `${collectionItems} ${extraCollectionPhoneField} ${extraCollectionEmailField} ${extraCollectionNameField}`
      )
      .populate(userField, "_id name surname")
      .populate(companyField, "_id name linkPath owner")
      .then(async (allCommunitings) => {
        const allUsers = [];
        const allUsersWithItems = [];
        const otherUsersWithoutAccount = [];
        const bulkArrayToUpdate = [];
        let avaibleSendSMS = false;
        if (!!smsContent) {
          if (
            !!smsContent.companySendSMSValidField &&
            !!smsContent.message &&
            !!smsContent.titleCompanySMSAlert &&
            !!companyId
          ) {
            const resultFunctionUpdate = await updateCompanyFunction({
              companyId: companyId,
              countItems: allCommunitings.length,
              titleCompanySendSMSAlert: smsContent.titleCompanySMSAlert,
              smsCompanyFieldValid: smsContent.companySendSMSValidField,
            });
            if (resultFunctionUpdate) {
              avaibleSendSMS = true;
            }
          }
        }
        for (const communitingItem of allCommunitings) {
          let extraFields = { extra: null };
          bulkArrayToUpdate.push({
            updateOne: {
              filter: {
                _id: communitingItem._id,
              },
              update: {
                $set: updateCollectionItemObject,
              },
            },
          });
          if (!!communitingItem[userField]) {
            if (!!communitingItem[userField]._id) {
              const isUserInAllUsers = allUsers.findIndex(
                (itemUser) =>
                  itemUser == communitingItem[userField]._id.toString()
              );
              if (isUserInAllUsers < 0) {
                allUsers.push(communitingItem[userField]._id.toString());

                const newItemUserWithItem = {
                  [userField]: communitingItem[userField]._id.toString(),
                  items: [communitingItem],
                  ...extraFields,
                };
                allUsersWithItems.push(newItemUserWithItem);
              } else {
                allUsersWithItems[isUserInAllUsers].items.push(communitingItem);
              }
            }
          } else {
            if (!!extraCollectionPhoneField && !!extraCollectionEmailField) {
              if (!!communitingItem[extraCollectionPhoneField]) {
                const findIndexItemNoUser = otherUsersWithoutAccount.findIndex(
                  (itemNoUser) =>
                    itemNoUser.customPhone ==
                    communitingItem[extraCollectionPhoneField]
                );
                if (findIndexItemNoUser > 0) {
                  otherUsersWithoutAccount[findIndexItemNoUser].items.push(
                    communitingItem
                  );
                } else {
                  const newItemNoUser = {
                    customPhone: communitingItem[extraCollectionPhoneField],
                    customEmail: !!communitingItem[extraCollectionEmailField]
                      ? communitingItem[extraCollectionEmailField]
                      : null,
                    items: [communitingItem],
                  };
                  otherUsersWithoutAccount.push(newItemNoUser);
                }
              }
            }
          }
        }

        for (const noUser of otherUsersWithoutAccount) {
          if (!!noUser.customPhone) {
            for (const itemNoUser of noUser.items) {
              if (avaibleSendSMS && !!companyChanged) {
                const userPhone = Buffer.from(
                  noUser.customPhone,
                  "base64"
                ).toString("utf-8");

                await sendVerifySMS({
                  phoneNumber: userPhone,
                  message: `${smsContent.message}, data: ${itemNoUser.day}-${itemNoUser.month}-${itemNoUser.year}, godzina: ${itemNoUser.timeStart}-${itemNoUser.timeEnd}, miasto: ${itemNoUser.city}`,
                });
              }
              if (!!emailContent) {
                if (
                  !!noUser.customEmail &&
                  !!emailContent.emailTitle &&
                  !!emailContent.emailMessage
                ) {
                  console.log("??????????");
                  sendEmail({
                    email: noUser.customEmail,
                    emailTitle: emailContent.emailTitle,
                    emailMessage: `${emailContent.emailMessage}, data: ${itemNoUser.day}-${itemNoUser.month}-${itemNoUser.year}, godzina: ${itemNoUser.timeStart}-${itemNoUser.timeEnd}, miasto: ${itemNoUser.city}`,
                  });
                }
              }
            }
          }
        }

        return User.find({
          _id: { $in: allUsers },
        })
          .select(
            "_id email phoneVerified phone whiteListVerifiedPhones vapidEndpoint accountVerified language"
          )
          .then(async (usersResult) => {
            const allUsersWithItemsWithVapid = [...allUsersWithItems];
            for (const userResult of usersResult) {
              const findUserWithItems = allUsersWithItems.find(
                (userWithItem) =>
                  userWithItem[userField].toString() ==
                  userResult._id.toString()
              );
              if (!!findUserWithItems) {
                const findIndexUserWithVapid =
                  allUsersWithItemsWithVapid.findIndex(
                    (userWithItem) => userWithItem[userField] == userResult._id
                  );
                if (findIndexUserWithVapid > 0) {
                  allUsersWithItemsWithVapid[
                    findIndexUserWithVapid
                  ].vapidEndpoint = userResult.vapidEndpoint;
                }
                for (const itemUser of findUserWithItems.items) {
                  let selectedPhoneNumber = null;
                  let selectedEmail = null;
                  if (avaibleSendSMS) {
                    if (!!userResult.phoneVerified) {
                      selectedPhoneNumber = userResult.phone;
                    } else {
                      if (!!userResult.whiteListVerifiedPhones) {
                        if (userResult.whiteListVerifiedPhones.length > 0) {
                          selectedPhoneNumber =
                            userResult.whiteListVerifiedPhones[
                              userResult.whiteListVerifiedPhones.length - 1
                            ];
                        }
                      }
                    }

                    if (!!selectedPhoneNumber && !!companyChanged) {
                      const userPhone = Buffer.from(
                        selectedPhoneNumber,
                        "base64"
                      ).toString("utf-8");
                      await sendVerifySMS({
                        phoneNumber: userPhone,
                        message: `${smsContent.message}, data: ${itemUser.day}-${itemUser.month}-${itemUser.year}, godzina: ${itemUser.timeStart}-${itemUser.timeEnd}, miasto: ${itemUser.city}`,
                      });
                    }
                  }
                  if (!!userResult.email) {
                    selectedEmail = !!userResult.email
                      ? userResult.email
                      : null;
                  }
                  console.log(selectedEmail);
                  if (!!emailContent) {
                    if (!!selectedEmail) {
                      const propsGenerator = generateEmail.generateContentEmail(
                        {
                          alertType: notificationContent.typeNotification,
                          companyChanged: companyChanged,
                          language: !!userResult.language
                            ? userResult.language
                            : "PL",
                          itemAlert: itemUser,
                          collection: collection,
                        }
                      );
                      // console.log(propsGenerator);
                      sendEmail({
                        email: selectedEmail,
                        ...propsGenerator,
                      });
                    }
                  }
                }
              }
            }
            if (!!notificationContent) {
              if (
                !!notificationContent.typeAlert &&
                !!notificationContent.typeNotification
              ) {
                sendMultiAlert({
                  typeAlert: notificationContent.typeAlert,
                  typeNotification: notificationContent.typeNotification,
                  workerUserField: workerField,
                  usersResultWithItems: allUsersWithItemsWithVapid,
                  avaibleSendAlertToWorker: true,
                  payload: {
                    title: notificationContent.payload.title,
                    body: `${notificationContent.payload.body}`,
                    icon: "",
                  },
                  companyChanged: companyChanged,
                  userField: userField,
                });
              }
            }

            return (
              selectedCollection
                // .bulkWrite(bulkArrayToUpdate)
                .bulkWrite([])
                .then(() => {
                  return true;
                })
                .catch((err) => {
                  if (!err.statusCode) {
                    err.statusCode = 501;
                    err.message = "Błąd podczas wysyłania powiadomień.";
                  }
                  next(err);
                })
            );
          });
      });
  }
};

exports.updateAllCollection = updateAllCollection;
exports.sendVerifySMS = sendVerifySMS;
exports.sendSMS = sendSMS;
exports.sendEmail = sendEmail;
exports.sendAlert = sendAlert;
exports.sendAll = sendAll;
