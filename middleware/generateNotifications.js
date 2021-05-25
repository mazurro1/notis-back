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

const sns = new AWS.SNS();

module.exports = async (
  usersIds = [],
  reserwationDoc = null,
  notifactionType = null,
  emailContent = [],
  payloadWebPush = null,
  docSMS = {
    // sendSMSCompany = false,
    // messageSMS = null,
    // companyId
    // smsTitle
  },
  sendToUserIdEmailSMS = null,
  defaultEmail = null,
  typeAlertData = "reserwationId"
) => {
  let bulkArrayToUpdate = [];
  let smsSendDone = false;
  return User.find({
    _id: { $in: usersIds },
    accountVerified: true,
  })
    .select(
      "_id email vapidEndpoint phoneVerified phone whiteListVerifiedPhones"
    )
    .then(async (usersResult) => {
      for (const userDoc of usersResult) {
        let newAlertData = null;
        if (!!reserwationDoc && !!notifactionType) {
          newAlertData = {
            [typeAlertData]: reserwationDoc._id,
            active: true,
            type: notifactionType,
            creationTime: new Date(),
            companyChanged: false,
          };

          io.getIO().emit(`user${userDoc._id}`, {
            action: "update-alerts",
            alertData: {
              [typeAlertData]: reserwationDoc,
              active: true,
              type: notifactionType,
              creationTime: new Date(),
              companyChanged: false,
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
        let validIsUserToSend = false;
        if (!!sendToUserIdEmailSMS) {
          validIsUserToSend =
            sendToUserIdEmailSMS.toString() == userDoc._id.toString();
        }
        if (emailContent.length === 2 && !!userDoc.email && validIsUserToSend) {
          transporter.sendMail({
            to: !!defaultEmail ? defaultEmail : userDoc.email,
            from: MAIL_INFO,
            subject: emailContent[0],
            html: emailContent[1],
          });
        }

        if (!!userDoc.vapidEndpoint && !!payloadWebPush) {
          webpush
            .sendNotification(
              userDoc.vapidEndpoint,
              JSON.stringify(payloadWebPush)
            )
            .then(() => {})
            .catch(() => {});
        }

        if (!!docSMS) {
          if (
            !!docSMS.sendSMSCompany &&
            !!docSMS.messageSMS &&
            !!docSMS.smsTitle &&
            sendToUserIdEmailSMS.toString() == userDoc._id.toString()
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
              await Company.updateOne(
                {
                  _id: docSMS.companyId,
                  sms: { $gt: 0 },
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
                      title: docSMS.smsTitle,
                    },
                  },
                },
                { upsert: true, safe: true },
                null
              )
                .then(async () => {
                  const params = {
                    Message: docSMS.messageSMS,
                    MessageStructure: "string",
                    PhoneNumber: `+48${userPhone}`,
                    MessageAttributes: {
                      "AWS.SNS.SMS.SenderID": {
                        DataType: "String",
                        StringValue: "Meetsy",
                      },
                    },
                  };
                  let snsResult = await sns
                    .publish(params, (err, data) => {
                      if (data) {
                        return data;
                      } else {
                        return false;
                      }
                    })
                    .promise();

                  if (!!snsResult) {
                    smsSendDone = true;
                  }
                })
                .catch((err) => {});
            }
          }
        }
      }

      if (emailContent.length === 2 && defaultEmail) {
        transporter.sendMail({
          to: defaultEmail,
          from: MAIL_INFO,
          subject: emailContent[0],
          html: emailContent[1],
        });
      }

      if (bulkArrayToUpdate.length > 0) {
        await User.bulkWrite(bulkArrayToUpdate)
          .then(() => {})
          .catch(() => {
            const error = new Error("Błąd podczas aktualizacji powiadomień.");
            error.statusCode = 422;
            throw error;
          });
      }
      return {
        notifactionDone: true,
        smsSendDone: smsSendDone,
      };
    });
};
