const User = require("../models/user");
const Company = require("../models/company");
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
  const bulkArrayToUpdate = [];
  let newAlertData = null;

  for (const userDoc of usersResult) {
    if (!!dateAlert && !!typeNotification && !!typeAlert) {
      newAlertData = {
        [typeAlert]: dateAlert._id,
        active: true,
        type: typeNotification,
        creationTime: new Date(),
        companyChanged: companyChanged,
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
      bulkArrayToUpdate.push({
        updateOne: {
          filter: {
            _id: userDoc._id,
          },
          update: {
            $inc: { alertActiveCount: 1 },
            $push: {
              alerts: {
                $each: [newAlertData],
                $position: 0,
              },
            },
          },
        },
      });
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

  if (bulkArrayToUpdate.length > 0) {
    User.bulkWrite(bulkArrayToUpdate)
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

const sendVerifySMS = async ({ phoneNumber = null, message = null }) => {
  if (!!phoneNumber && !!message) {
    const params = {
      Message: message,
      PhoneNumber: `+48${phoneNumber}`,
    };
    snsResultCustom = await sns
      .publish(params, (err, data) => {
        if (data) {
          return data;
        } else {
          return false;
        }
      })
      .promise();

    return snsResultCustom;
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
      .then(async (updated) => {
        const params = {
          Message: message,
          PhoneNumber: `+48${customPhone}`,
        };
        snsResultCustom = await sns
          .publish(params, (err, data) => {
            if (data) {
              return data;
            } else {
              return false;
            }
          })
          .promise();

        if (!!snsResultCustom) {
          return snsResultCustom;
        } else {
          return snsResultCustom;
        }
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
                .then(async () => {
                  const params = {
                    Message: message,
                    PhoneNumber: `+48${userPhone}`,
                  };
                  snsResult = await sns
                    .publish(params, (err, data) => {
                      if (data) {
                        return data;
                      } else {
                        return false;
                      }
                    })
                    .promise();
                  if (!!snsResult) {
                    return snsResult;
                  } else {
                    return snsResult;
                  }
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

  if (!!clientId) {
    return User.find({
      _id: { $in: usersId },
    })
      .select(
        "_id email phoneVerified phone whiteListVerifiedPhones vapidEndpoint accountVerified"
      )
      .then(async (users) => {
        const client = users.find(
          (user) => user._id.toString() == clientId.toString()
        );

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

exports.sendVerifySMS = sendVerifySMS;
exports.sendSMS = sendSMS;
exports.sendEmail = sendEmail;
exports.sendAlert = sendAlert;
exports.sendAll = sendAll;
