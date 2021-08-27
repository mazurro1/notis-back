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

const validateEmail = (email) => {
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

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

const sendMultiAlert = ({
  typeAlert = "reserwationId",
  typeNotification = "reserwation_created",
  workerUserField = "",
  usersResultWithItems = [],
  avaibleSendAlertToWorker = false,
  payload = {
    extraTitle: "",
    collection: "",
  },
  companyChanged = true,
  userField = "",
  returnItemsToUpdate = false,
}) => {
  if (!!typeNotification) {
    const newInserItems = [];
    for (const userDoc of usersResultWithItems) {
      for (const userItem of userDoc.items) {
        if (!!payload) {
          if (!!userDoc.vapidEndpoint && !!payload.collection) {
            const {
              title,
              day,
              dayText,
              hours,
              hoursText,
              reserwation,
              reserwationText,
              service,
              serviceText,
              communiting,
              communitingText,
              defaultText,
            } = generateEmail.generateContentEmail({
              alertType: typeNotification,
              companyChanged: companyChanged,
              language: !!userDoc.language ? userDoc.language : "PL",
              itemAlert: userItem,
              collection: payload.collection,
            });

            const bodyPayload = `${!!title ? title : ""} ${
              !!day ? `${dayText}: ${day}` : ""
            } ${!!hours ? `, ${hoursText}: ${hours}` : ""} ${
              !!reserwation ? `, ${reserwationText}: ${reserwation}` : ""
            } ${!!service ? `, ${serviceText}: ${service}` : ""} ${
              !!communiting ? `, ${communitingText}: ${communiting}` : ""
            } ${!!defaultText ? defaultText : ""}`;

            const titlePayload = !!payload.extraTitle
              ? `Meetsy - ${payload.extraTitle}`
              : "Meetsy";

            webpush
              .sendNotification(
                userDoc.vapidEndpoint,
                JSON.stringify({
                  title: titlePayload,
                  body: bodyPayload,
                  icon: "",
                })
              )
              .then(() => {})
              .catch(() => {});

            if (!!avaibleSendAlertToWorker && !!workerUserField) {
              if (!!userItem[workerUserField]) {
                if (!!userItem[workerUserField].vapidEndpoint) {
                  webpush
                    .sendNotification(
                      userItem[workerUserField].vapidEndpoint,
                      JSON.stringify({
                        title: titlePayload,
                        body:
                          userItem[workerUserField].language == "PL"
                            ? "Nowe powiadomienie"
                            : "New notification",
                        icon: "",
                      })
                    )
                    .then(() => {})
                    .catch(() => {});
                }
              }
            }
          }
        }

        if (!!typeAlert) {
          if (!!workerUserField) {
            if (!!userItem[workerUserField]) {
              if (!!userItem[workerUserField].vapidEndpoint) {
                userItem[workerUserField].vapidEndpoint = null;
              }
              if (!!userItem[workerUserField].language) {
                userItem[workerUserField].language = null;
              }
            }
          }

          if (!!userItem[userField]) {
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
          }

          if (!!avaibleSendAlertToWorker && !!workerUserField) {
            if (!!userItem[workerUserField]) {
              if (!!userItem[workerUserField]._id) {
                const newAlertDataWorker = {
                  [typeAlert]: userItem._id,
                  active: true,
                  type: typeNotification,
                  creationTime: new Date(),
                  companyChanged: companyChanged,
                  toUserId: userItem[workerUserField]._id,
                };
                io.getIO().emit(`user${userItem[workerUserField]._id}`, {
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
          }
        }
      }
    }

    if (newInserItems.length > 0 && !returnItemsToUpdate) {
      Alert.insertMany(newInserItems)
        .then(() => {})
        .catch((err) => {
          const error = new Error(err);
          error.statusCode = 422;
          throw error;
        });
    } else if (returnItemsToUpdate) {
      return newInserItems;
    }
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
  link = null,
  linkName = null,
}) => {
  if (
    !!email &&
    (!!title ||
      !!defaultText ||
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
        link: link,
        linkName: linkName,
      },
      (err, data) => {
        if (!err) {
          const validAttachments = !!attachments ? attachments : [];
          transporter.sendMail({
            to: email,
            from: MAIL_INFO,
            subject: title,
            html: data,
            attachments: validAttachments,
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
  companyField = "",
  filtersCollection = null,
  extraPopulate = ["", ""],
  collection = "",
  collectionItems = "",
  extraCollectionPhoneField = "",
  extraCollectionEmailField = "",
  extraCollectionNameField = "",
  userField = "",
  workerField = "",
  updateCollectionItemObject = null,
  sendEmailValid = true,
  notificationContent = {
    typeAlert: "",
    avaibleSendAlertToWorker: true,
  },
  smsContent = {
    companySendSMSValidField: null,
    collectionFieldSMSOnSuccess: null,
    titleCompanySMSAlert: "",
  },
  companyChanged = false,
  typeNotification = "",
  deleteOpinion = false,
}) => {
  const fieldOpinionId = "opinionId";

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
    !!updateCollectionItemObject &&
    !!companyField &&
    !!typeNotification &&
    extraPopulate.length === 2
  ) {
    return selectedCollection
      .find(filtersCollection)
      .select(
        `${collectionItems} ${extraCollectionPhoneField} ${extraCollectionEmailField} ${extraCollectionNameField} ${
          deleteOpinion ? fieldOpinionId : ""
        }`
      )
      .populate(userField, "_id name surname")
      .populate(workerField, "_id vapidEndpoint language name surname")
      .populate(companyField, "_id name linkPath owner")
      .populate(fieldOpinionId, "")
      .populate(extraPopulate[0], extraPopulate[1])
      .then(async (allCommunitings) => {
        const allUsers = [];
        const allUsersWithItems = [];
        const otherUsersWithoutAccount = [];
        const bulkArrayToUpdate = [];
        const allUpdatedItems = [];
        const allOpinionIdsToDelete = [];
        const companysItemsAndAvaibleSendSMSStatus = [];

        //filters items collections to user or not user items
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
          if (deleteOpinion) {
            if (!!communitingItem.fieldOpinionId) {
              if (!!communitingItem.fieldOpinionId._id) {
                allOpinionIdsToDelete.push(communitingItem.fieldOpinionId._id);
                communitingItem.fieldOpinionId = null;
              }
            }
          }

          //update item in collection to show ACTUAL alerts details after update
          const newItemCollectionWithActualization = communitingItem;
          for (const itemUpdateCollectionItemObject in updateCollectionItemObject) {
            newItemCollectionWithActualization[itemUpdateCollectionItemObject] =
              updateCollectionItemObject[itemUpdateCollectionItemObject];
          }
          allUpdatedItems.push(newItemCollectionWithActualization);

          //find company and count sms to send
          if (!!communitingItem[companyField]) {
            if (!!communitingItem[companyField]._id) {
              const findIndexCompanyInArray =
                companysItemsAndAvaibleSendSMSStatus.findIndex(
                  (itemCompany) =>
                    itemCompany.companyId.toString() ==
                    communitingItem[companyField]._id.toString()
                );

              if (findIndexCompanyInArray >= 0) {
                companysItemsAndAvaibleSendSMSStatus[
                  findIndexCompanyInArray
                ].countSendSMS =
                  companysItemsAndAvaibleSendSMSStatus[findIndexCompanyInArray]
                    .countSendSMS + 1;
              } else {
                const newItemCompany = {
                  companyId: communitingItem[companyField]._id.toString(),
                  avaibleSendSMS: false,
                  countSendSMS: 1,
                };
                companysItemsAndAvaibleSendSMSStatus.push(newItemCompany);
              }
            }
          }

          //filter items to users
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
                  items: [newItemCollectionWithActualization],
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
                if (findIndexItemNoUser >= 0) {
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

        //check is avaible count sms to send to users
        if (!!smsContent) {
          if (
            !!smsContent.companySendSMSValidField &&
            !!smsContent.titleCompanySMSAlert
          ) {
            for (const [
              indexCompanysItems,
              itemCompanysItemsAndAvaibleSendSMSStatus,
            ] of companysItemsAndAvaibleSendSMSStatus.entries()) {
              const resultFunctionUpdate = await updateCompanyFunction({
                companyId: itemCompanysItemsAndAvaibleSendSMSStatus.companyId,
                countItems:
                  itemCompanysItemsAndAvaibleSendSMSStatus.countSendSMS,
                titleCompanySendSMSAlert: smsContent.titleCompanySMSAlert,
                smsCompanyFieldValid: smsContent.companySendSMSValidField,
              });

              if (resultFunctionUpdate) {
                companysItemsAndAvaibleSendSMSStatus[
                  indexCompanysItems
                ].avaibleSendSMS = true;
              }
            }
          }
        }

        // send alerts to user isn't in company
        for (const noUser of otherUsersWithoutAccount) {
          if (!!noUser.customPhone) {
            for (const itemNoUser of noUser.items) {
              //takie fields from message generator
              const propsGenerator = generateEmail.generateContentEmail({
                alertType: typeNotification,
                companyChanged: companyChanged,
                language: "PL",
                itemAlert: itemNoUser,
                collection: collection,
              });

              //generate phone email message
              let findCompanyToSendSMS = null;
              if (!!itemNoUser[companyField]) {
                if (!!itemNoUser[companyField]._id) {
                  findCompanyToSendSMS =
                    companysItemsAndAvaibleSendSMSStatus.find(
                      (itemCompany) =>
                        itemCompany.companyId == itemNoUser[companyField]._id
                    );
                }
              }

              if (!!findCompanyToSendSMS) {
                if (findCompanyToSendSMS.avaibleSendSMS && !!companyChanged) {
                  const userPhone = Buffer.from(
                    noUser.customPhone,
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
                      ? `, ${propsGenerator.hoursText}: ${propsGenerator.hours}`
                      : ""
                  } ${
                    !!propsGenerator.reserwation
                      ? `, ${propsGenerator.reserwationText}: ${propsGenerator.reserwation}`
                      : ""
                  } ${
                    !!propsGenerator.service
                      ? `, ${propsGenerator.serviceText}: ${propsGenerator.service}`
                      : ""
                  } ${
                    !!propsGenerator.communiting
                      ? `, ${propsGenerator.communitingText}: ${propsGenerator.communiting}`
                      : ""
                  } ${
                    !!propsGenerator.defaultText
                      ? propsGenerator.defaultText
                      : ""
                  }`;

                  //send sms to user
                  const resultSMS = await sendVerifySMS({
                    phoneNumber: userPhone,
                    message: bodySMS,
                  });

                  //update item collection when send sms success
                  if (!!resultSMS) {
                    bulkArrayToUpdate.push({
                      updateOne: {
                        filter: {
                          _id: itemNoUser._id,
                        },
                        update: {
                          $set: smsContent.collectionFieldSMSOnSuccess,
                        },
                      },
                    });
                  }
                }
              }

              //send email to user
              if (!!sendEmailValid) {
                if (!!noUser.customEmail) {
                  if (validateEmail(noUser.customEmail)) {
                    sendEmail({
                      email: noUser.customEmail,
                      ...propsGenerator,
                    });
                  }
                }
              }
            }
          }
        }

        //send alert to worker
        if (!!notificationContent) {
          if (
            !!notificationContent.typeAlert &&
            !!typeNotification &&
            !!notificationContent.avaibleSendAlertToWorker
          ) {
            sendMultiAlert({
              typeAlert: notificationContent.typeAlert,
              typeNotification: typeNotification,
              workerUserField: workerField,
              usersResultWithItems: otherUsersWithoutAccount,
              avaibleSendAlertToWorker:
                notificationContent.avaibleSendAlertToWorker,
              payload: {
                collection: collection,
              },
              companyChanged: companyChanged,
              userField: userField,
            });
          }
        }

        // send alerts to users in company
        return User.find({
          _id: { $in: allUsers },
        })
          .select(
            "_id email phoneVerified phone whiteListVerifiedPhones vapidEndpoint accountVerified language"
          )
          .then(async (usersResult) => {
            const allUsersWithItemsWithVapid = [...allUsersWithItems];

            //maps users
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

                //add extra field to user
                if (findIndexUserWithVapid >= 0) {
                  if (!!userResult.vapidEndpoint) {
                    allUsersWithItemsWithVapid[
                      findIndexUserWithVapid
                    ].vapidEndpoint = userResult.vapidEndpoint;
                  }
                  if (!!userResult.language) {
                    allUsersWithItemsWithVapid[
                      findIndexUserWithVapid
                    ].language = userResult.language;
                  }
                }

                //map items user
                for (const itemUser of findUserWithItems.items) {
                  //takie fields from message generator
                  const propsGenerator = generateEmail.generateContentEmail({
                    alertType: typeNotification,
                    companyChanged: companyChanged,
                    language: !!userResult.language
                      ? userResult.language
                      : "PL",
                    itemAlert: itemUser,
                    collection: collection,
                  });

                  let selectedPhoneNumber = null;
                  let selectedEmail = null;

                  //generate user phone and email
                  let findCompanyToSendSMS = null;
                  if (!!itemUser[companyField]) {
                    if (!!itemUser[companyField]._id) {
                      findCompanyToSendSMS =
                        companysItemsAndAvaibleSendSMSStatus.find(
                          (itemCompany) =>
                            itemCompany.companyId == itemUser[companyField]._id
                        );
                    }
                  }
                  if (!!findCompanyToSendSMS) {
                    if (findCompanyToSendSMS.avaibleSendSMS) {
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
                          !!propsGenerator.defaultText
                            ? propsGenerator.defaultText
                            : ""
                        }`;

                        //send to user sms
                        const resultSMS = await sendVerifySMS({
                          phoneNumber: userPhone,
                          message: bodySMS,
                        });

                        //if sms success update item collection
                        if (!!resultSMS) {
                          bulkArrayToUpdate.push({
                            updateOne: {
                              filter: {
                                _id: itemUser._id,
                              },
                              update: {
                                $set: smsContent.collectionFieldSMSOnSuccess,
                              },
                            },
                          });
                        }
                      }
                    }
                  }
                  if (!!userResult.email) {
                    selectedEmail = !!userResult.email
                      ? userResult.email
                      : null;
                  }

                  //send to user email
                  if (!!sendEmailValid) {
                    if (!!selectedEmail) {
                      if (validateEmail(selectedEmail)) {
                        sendEmail({
                          email: selectedEmail,
                          ...propsGenerator,
                        });
                      }
                    }
                  }
                }
              }
            }
            //send to client and worker alert
            if (!!notificationContent) {
              if (!!notificationContent.typeAlert && !!typeNotification) {
                sendMultiAlert({
                  typeAlert: notificationContent.typeAlert,
                  typeNotification: typeNotification,
                  workerUserField: workerField,
                  usersResultWithItems: allUsersWithItemsWithVapid,
                  avaibleSendAlertToWorker:
                    notificationContent.avaibleSendAlertToWorker,
                  payload: {
                    collection: collection,
                  },
                  companyChanged: companyChanged,
                  userField: userField,
                });
              }
            }

            //update items collection
            return selectedCollection
              .bulkWrite(bulkArrayToUpdate)
              .then(() => {
                if (allOpinionIdsToDelete.length > 0) {
                  selectedCollection.deleteMany(
                    allOpinionIdsToDelete,
                    (err, obj) => {
                      if (err) throw err;
                    }
                  );
                }
                return allUpdatedItems;
              })
              .catch((err) => {
                if (!err.statusCode) {
                  err.statusCode = 501;
                  err.message = "Błąd podczas wysyłania powiadomień.";
                }
                next(err);
              });
          });
      });
  } else {
    console.log(
      !!selectedCollection,
      !!workerField,
      !!userField,
      !!collectionItems,
      !!filtersCollection,
      !!updateCollectionItemObject,
      !!companyField,
      !!typeNotification
    );
    throw new Error("Error valid notifications");
  }
};

exports.updateAllCollection = updateAllCollection;
exports.sendVerifySMS = sendVerifySMS;
exports.sendSMS = sendSMS;
exports.sendEmail = sendEmail;
exports.sendMultiAlert = sendMultiAlert;
