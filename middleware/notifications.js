const User = require("../models/user");
const Alert = require("../models/alert");
const Company = require("../models/company");
const Communiting = require("../models/Communiting");
const webpush = require("web-push");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const io = require("../socket");
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
          toUserId: userDoc.userId,
        };
        newInserItems.push(newAlertDataUser);

        io.getIO().emit(`user${userDoc.userId}`, {
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

const sendEmail = ({ email, emailTitle, emailMessage, attachments = null }) => {
  if ((!!email && !!emailTitle, !!emailMessage)) {
    const validAttachments = !!attachments ? attachments : {};
    transporter.sendMail({
      to: email,
      from: MAIL_INFO,
      subject: emailTitle,
      html: emailMessage,
      ...validAttachments,
    });
  }
};

const sendVerifySMS = ({ phoneNumber = null, message = null }) => {
  if (!!phoneNumber && !!message) {
    const params = {
      Message: message,
      PhoneNumber: `+48${phoneNumber}`,
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
        "_id email phoneVerified phone whiteListVerifiedPhones vapidEndpoint accountVerified"
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

const updateAllCommuniting = async ({
  companyId = null,
  filtersCommuniting = {},
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
    companyChanged: true,
  },
  smsContent = {
    companyId: null,
    companySendSMSValidField: null,
    titleCompanySendSMS: "",
    titleCompanySMSAlert: "",
    message: "",
  },
}) => {
  return Communiting.find(filtersCommuniting)
    .select(
      "_id city description userId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd"
    )
    .populate("userId", "_id name surname")
    .populate("companyId", "_id name linkPath owner")
    .then(async (allCommunitings) => {
      const allUsers = [];
      const allUsersWithItems = [];
      for (const communitingItem of allCommunitings) {
        if (!!communitingItem.userId) {
          if (!!communitingItem.userId._id) {
            const isUserInAllUsers = allUsers.findIndex(
              (itemUser) => itemUser == communitingItem.userId._id
            );
            if (isUserInAllUsers < 0) {
              allUsers.push(communitingItem.userId._id);
              const newItemUserWithItem = {
                userId: communitingItem.userId._id,
                items: [communitingItem],
              };
              allUsersWithItems.push(newItemUserWithItem);
            } else {
              allUsersWithItems[isUserInAllUsers].items.push(communitingItem);
            }
          }
        }
      }
      return User.find({
        _id: { $in: allUsers },
      })
        .select(
          "_id email phoneVerified phone whiteListVerifiedPhones vapidEndpoint accountVerified"
        )
        .then(async (usersResult) => {
          let avaibleSendSMS = false;
          if (!!smsContent) {
            if (
              !!smsContent.companyId &&
              !!smsContent.companySendSMSValidField &&
              !!smsContent.message &&
              !!smsContent.titleCompanySMSAlert
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
          const allUsersWithItemsWithVapid = [...allUsersWithItems];
          for (const userResult of usersResult) {
            const findUserWithItems = allUsersWithItems.find(
              (userWithItem) =>
                userWithItem.userId.toString() == userResult._id.toString()
            );
            if (!!findUserWithItems) {
              const findIndexUserWithVapid =
                allUsersWithItemsWithVapid.findIndex(
                  (userWithItem) => userWithItem.userId == userResult._id
                );
              if (findIndexUserWithVapid > 0) {
                allUsersWithItemsWithVapid[
                  findIndexUserWithVapid
                ].vapidEndpoint = userResult.vapidEndpoint;
              }
              for (const itemUser of findUserWithItems.items) {
                if (avaibleSendSMS) {
                  let selectedPhoneNumber = null;
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

                  if (!!selectedPhoneNumber) {
                    const userPhone = Buffer.from(
                      selectedPhoneNumber,
                      "base64"
                    ).toString("utf-8");
                    sendVerifySMS({
                      phoneNumber: userPhone,
                      message: `${smsContent.message}, data: ${itemUser.day}-${itemUser.month}-${itemUser.year}, godzina: ${itemUser.timeStart}-${itemUser.timeEnd}, miasto: ${itemUser.city}`,
                    });
                  }
                }
                if (!!emailContent) {
                  if (
                    !!userResult.email &&
                    !!emailContent.emailTitle &&
                    !!emailContent.emailMessage
                  ) {
                    sendEmail({
                      email: userResult.email,
                      emailTitle: emailContent.emailTitle,
                      emailMessage: `${emailContent.emailMessage}, data: ${itemUser.day}-${itemUser.month}-${itemUser.year}, godzina: ${itemUser.timeStart}-${itemUser.timeEnd}, miasto: ${itemUser.city}`,
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
                workerUserField: "workerUserId",
                usersResultWithItems: allUsersWithItemsWithVapid,
                avaibleSendAlertToWorker: true,
                payload: {
                  title: notificationContent.payload.title,
                  body: `${notificationContent.payload.body}`,
                  icon: "",
                },
                companyChanged: notificationContent.companyChanged,
              });
            }
          }
        });
    });
};

exports.updateAllCommuniting = updateAllCommuniting;
exports.sendVerifySMS = sendVerifySMS;
exports.sendSMS = sendSMS;
exports.sendEmail = sendEmail;
exports.sendAlert = sendAlert;
exports.sendAll = sendAll;
