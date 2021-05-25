const User = require("../models/user");
const Company = require("../models/company");
const Reserwation = require("../models/reserwation");
const Service = require("../models/service");
const Communiting = require("../models/Communiting");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const io = require("../socket");
const getImgBuffer = require("../getImgBuffer");
const webpush = require("web-push");
const generateNotifications = require("../middleware/generateNotifications");

require("dotenv").config();
const {
  TOKEN_PASSWORD,
  BCRIPT_SECURITY_VALUE,
  BCRIPT_EXPIRES_IN,
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  AWS_BUCKET,
  AWS_PATH_URL,
  SITE_FRONT,
  MAIL_INFO,
  MAIL_PORT,
  MAIL_HOST,
  MAIL_PASSWORD,
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

const s3Bucket = new AWS.S3({
  params: {
    Bucket: AWS_BUCKET,
  },
});
const sns = new AWS.SNS();

function makeid(length) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const imageUpload = (path, buffer) => {
  const data = {
    Key: path,
    Body: buffer,
    ContentEncoding: "base64",
    ContentType: "image/jpeg",
    ACL: "public-read",
  };
  return new Promise((resolve, reject) => {
    s3Bucket.putObject(data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(AWS_PATH_URL + path);
      }
    });
  });
};

const getImageUrl = async (type, base64Image) => {
  const buffer = getImgBuffer(base64Image);
  const currentTime = new Date().getTime();
  return imageUpload(`${type}/${currentTime}.jpeg`, buffer);
};

exports.registration = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const phoneNumber = req.body.phoneNumber;
  const userName = req.body.userName;
  const userSurname = req.body.userSurname;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.countDocuments({ email: email })
    .then((userDoc) => {
      if (!!!userDoc) {
        const hashedPhoneNumber = Buffer.from(phoneNumber, "utf-8").toString(
          "base64"
        );
        return User.countDocuments({ phone: hashedPhoneNumber }).then(
          (userCountPhone) => {
            if (!!!userCountPhone) {
              return bcrypt
                .hash(password, Number(BCRIPT_EXPIRES_IN))
                .then((hashedPassword) => {
                  if (hashedPassword) {
                    const codeToVerified = makeid(6);

                    const hashedCodeToVerified = Buffer.from(
                      codeToVerified.toUpperCase(),
                      "utf-8"
                    ).toString("base64");

                    const hashedUserName = Buffer.from(
                      userName,
                      "utf-8"
                    ).toString("base64");

                    const hashedUserSurname = Buffer.from(
                      userSurname,
                      "utf-8"
                    ).toString("base64");

                    const user = new User({
                      email: email,
                      name: hashedUserName,
                      surname: hashedUserSurname,
                      password: hashedPassword,
                      phone: hashedPhoneNumber,
                      accountVerified: false,
                      codeToVerified: hashedCodeToVerified,
                      hasPhone: true,
                      company: null,
                      allCompanys: [],
                      phoneVerified: false,
                      stamps: [],
                      alerts: [],
                    });
                    const token = jwt.sign(
                      {
                        email: user.email,
                        userId: user._id.toString(),
                      },
                      TOKEN_PASSWORD,
                      {
                        expiresIn: BCRIPT_EXPIRES_IN,
                      }
                    );
                    user.loginToken = token;
                    return user.save();
                  }
                });
            } else {
              const error = new Error("Numer telefonu zajęty.");
              error.statusCode = 440;
              throw error;
            }
          }
        );
      } else {
        const error = new Error("Adres email zajęty.");
        error.statusCode = 441;
        throw error;
      }
    })
    .then((result) => {
      const userName = Buffer.from(result.name, "base64").toString("utf-8");
      const userSurname = Buffer.from(result.surname, "base64").toString(
        "utf-8"
      );
      const unhashedCodeToVerified = Buffer.from(
        result.codeToVerified,
        "base64"
      ).toString("utf-8");
      transporter.sendMail({
        to: result.email,
        from: MAIL_INFO,
        subject: "Tworzenie konta zakończone powodzeniem",
        html: `<h1>Utworzono nowe konto</h1> ${unhashedCodeToVerified}`,
      });

      res.status(200).json({
        userName: userName,
        userSurname: userSurname,
        userId: result._id.toString(),
        email: result.email,
        token: result.loginToken,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd serwera";
      }
      next(err);
    });
};

exports.login = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    email: email,
  })
    .select(
      "email blockUserSendVerifiedPhoneSms blockUserChangePhoneNumber _id phoneVerified imageUrl hasPhone name surname alerts favouritesCompanys company stamps loginToken password codeToResetPassword token accountVerified alertActiveCount imageOther"
    )
    .slice("alerts", 10)
    .populate("favouritesCompanys", "_id linkPath name")
    .populate(
      "allCompanys",
      "accountVerified allDataVerified owner pauseCompany name workers._id workers.user workers.permissions sms premium"
    )
    .populate(
      "stamps.companyId",
      "_id linkPath companyStamps services.serviceName services._id name "
    )
    .populate(
      "stamps.reserwations",
      "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company visitCanceled fullDate"
    )
    .populate({
      path: "alerts.reserwationId",
      select:
        "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company",
      populate: {
        path: "company fromUser",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "alerts.serviceId",
      select:
        "_id objectName description userId companyId month year day createdAt",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "alerts.communitingId",
      select:
        "_id city description userId companyId month year day timeStart timeEnd",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .then((user) => {
      if (!!user) {
        bcrypt
          .compare(password, user.password)
          .then((doMatch) => {
            if (doMatch) {
              const token = jwt.sign(
                {
                  email: user.email,
                  userId: user._id.toString(),
                },
                TOKEN_PASSWORD,
                {
                  expiresIn: BCRIPT_EXPIRES_IN,
                }
              );
              user.loginToken = token;
              user.codeToResetPassword = null;
              return user.save();
            } else {
              const error = new Error("Błędne hasło.");
              error.statusCode = 403;
              throw error;
            }
          })
          .then((userWithToken) => {
            const userName = Buffer.from(userWithToken.name, "base64").toString(
              "utf-8"
            );
            const userSurname = Buffer.from(
              userWithToken.surname,
              "base64"
            ).toString("utf-8");

            const isNotCompanyStamps = userWithToken.stamps.some(
              (stamp) => stamp.companyId === null
            );
            const isNotCompanyFavourites =
              userWithToken.favouritesCompanys.some((fav) => fav === null);
            if (isNotCompanyStamps || isNotCompanyFavourites) {
              if (isNotCompanyStamps) {
                const filterStampsUser = userWithToken.stamps.filter(
                  (stamp) => stamp.companyId !== null
                );
                userWithToken.stamps = filterStampsUser;
              }
              if (isNotCompanyFavourites) {
                const filterFavUser = userWithToken.favouritesCompanys.filter(
                  (fav) => fav !== null
                );
                userWithToken.favouritesCompanys = filterFavUser;
              }
              userWithToken.save();
            }

            let findCompanyInAllCompanys = null;
            if (!!userWithToken.company) {
              findCompanyInAllCompanys = userWithToken.allCompanys.find(
                (itemCompany) => {
                  return (
                    itemCompany._id.toString() ==
                    userWithToken.company.toString()
                  );
                }
              );
            }

            res.status(201).json({
              userId: userWithToken._id.toString(),
              email: userWithToken.email,
              userName: userName,
              userSurname: userSurname,
              token: userWithToken.loginToken,
              accountVerified: userWithToken.accountVerified,
              company: !!findCompanyInAllCompanys
                ? findCompanyInAllCompanys
                : userWithToken.allCompanys.length > 0
                ? userWithToken.allCompanys[0]
                : null,
              defaultCompany: !!userWithToken.company
                ? userWithToken.company
                : userWithToken.allCompanys.length > 0
                ? userWithToken.allCompanys[0]._id
                : null,
              allCompanys: userWithToken.allCompanys,
              alerts: userWithToken.alerts,
              alertActiveCount: !!userWithToken.alertActiveCount
                ? userWithToken.alertActiveCount
                : 0,
              imageUrl: !!user.imageOther ? user.imageOther : user.imageUrl,
              hasPhone: user.hasPhone,
              stamps: user.stamps,
              favouritesCompanys: user.favouritesCompanys,
              phoneVerified: user.phoneVerified,
              blockUserChangePhoneNumber: user.blockUserChangePhoneNumber,
              blockUserSendVerifiedPhoneSms: user.blockUserSendVerifiedPhoneSms,
              vapidPublic: PUBLIC_KEY_VAPID,
            });
          })
          .catch((err) => {
            if (!err.statusCode) {
              err.statusCode = 501;
              err.message = "Błąd serwera";
            }
            next(err);
          });
      } else {
        res.status(422).json({
          message: "Brak użytkownika",
        });
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd serwera";
      }
      next(err);
    });
};

exports.sentAgainVerifiedEmail = (req, res, next) => {
  const userId = req.userId;
  User.findOne({
    _id: userId,
    accountVerified: false,
  })
    .select("_id accountVerified codeToVerified email")
    .then((user) => {
      if (!!user) {
        const unhashedCodeToVerified = Buffer.from(
          user.codeToVerified,
          "base64"
        ).toString("utf-8");
        transporter.sendMail({
          to: user.email,
          from: MAIL_INFO,
          subject: "Tworzenie konta zakończone powodzeniem",
          html: `<h1>Utworzono nowe konto</h1> ${unhashedCodeToVerified.toUpperCase()}`,
        });
        res.status(201).json({
          message: "Email został wysłany",
        });
      } else {
        const error = new Error("Brak użytkownika");
        error.statusCode = 502;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Brak podanego użytkownika, lub konto zostało już aktywowane.";
      }
      next(err);
    });
};

exports.getUserPhone = (req, res, next) => {
  const userId = req.userId;
  User.findOne({
    _id: userId,
  })
    .select("_id phone")
    .then((user) => {
      if (!!user) {
        if (!!user.phone) {
          const userPhone = Buffer.from(user.phone, "base64").toString("utf-8");
          res.status(201).json({
            userPhone: userPhone,
          });
        } else {
          const error = new Error("Brak numeru telefonu.");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 502;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas wysyłania numeru użytkownika.";
      }
      next(err);
    });
};

exports.getCustomUserPhone = (req, res, next) => {
  const selectedUserId = req.body.selectedUserId;
  const companyId = req.body.companyId;
  const userId = req.userId;

  Company.findOne({ _id: companyId })
    .select("_id workers.permissions workers.user owner")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 6
            );
          }
        }
        if (hasPermission) {
          User.findOne({
            _id: selectedUserId,
          })
            .select("phone _id whiteListVerifiedPhones phoneVerified")
            .then((user) => {
              if (!!user) {
                let selectedPhoneNumber = null;
                if (!!user.phoneVerified) {
                  selectedPhoneNumber = user.phone;
                } else {
                  if (!!user.whiteListVerifiedPhones) {
                    if (user.whiteListVerifiedPhones.length > 0) {
                      selectedPhoneNumber =
                        user.whiteListVerifiedPhones[
                          user.whiteListVerifiedPhones.length - 1
                        ];
                    }
                  }
                }
                if (!!selectedPhoneNumber) {
                  const userPhone = Buffer.from(
                    selectedPhoneNumber,
                    "base64"
                  ).toString("utf-8");
                  res.status(201).json({
                    userPhone: userPhone,
                  });
                } else {
                  res.status(201).json({
                    userPhone: "None",
                  });
                }
              } else {
                const error = new Error("Brak podanego użytkownika.");
                error.statusCode = 401;
                throw error;
              }
            })
            .catch((err) => {
              if (!err.statusCode) {
                err.statusCode = 501;
                err.message = "Błąd podczas wysyłania numeru użytkownika.";
              }
              next(err);
            });
        } else {
          const error = new Error("Brak dostępu.");
          error.statusCode = 401;
          throw error;
        }
      } else {
        const error = new Error("Brak wybranej firmy.");
        error.statusCode = 403;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak podanej firmy.";
      }
      next(err);
    });
};

exports.veryfiedEmail = (req, res, next) => {
  const userId = req.userId;
  const codeSent = req.body.codeToVerified;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
    accountVerified: false,
  })
    .select("_id accountVerified codeToVerified company email")
    .then((user) => {
      if (!!user) {
        const unhashedCodeToVerified = Buffer.from(
          user.codeToVerified,
          "base64"
        ).toString("utf-8");
        if (unhashedCodeToVerified.toUpperCase() === codeSent.toUpperCase()) {
          user.codeToVerified = null;
          user.accountVerified = true;
          user.company = null;
          user.allCompanys = [];
          return user.save();
        } else {
          res.status(403).json({
            message: "Zły kod uwietrznienia",
          });
        }
      } else {
        res.status(422).json({
          message: "Brak użytkownika",
        });
      }
    })
    .then((result) => {
      transporter.sendMail({
        to: result.email,
        from: MAIL_INFO,
        subject: "Tworzenie konta zakończone powodzeniem",
        html: `<h1>Adres e-mail został zweryfikowany</h1>`,
      });
      res.status(201).json({
        accountVerified: result.accountVerified,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Brak podanego użytkownika, lub konto zostało już aktywowane.";
      }
      next(err);
    });
};

exports.resetAllerts = (req, res, next) => {
  const userId = req.userId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select("alerts _id alertActiveCount")
    .where({ "alerts.active": true })
    .then((user) => {
      if (!!user) {
        const bulkArrayToUpdate = [];
        user.alerts.forEach((alert, index) => {
          bulkArrayToUpdate.push({
            updateOne: {
              filter: {
                _id: user._id,
                "alerts._id": alert._id,
              },
              update: {
                $set: {
                  "alerts.$.active": false,
                  alertActiveCount: 0,
                },
              },
            },
          });
        });
        return User.bulkWrite(bulkArrayToUpdate)
          .then(() => {
            return true;
          })
          .catch((err) => {
            console.log(err);
            const error = new Error("Błąd podczas aktualizacji powiadomień.");
            error.statusCode = 422;
            throw error;
          });
      } else {
        return true;
      }
    })
    .then(() => {
      res.status(200).json({
        message: "Zaktualizowano alerty",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd serwera.";
      }
      next(err);
    });
};

exports.getMoreAlerts = (req, res, next) => {
  const userId = req.userId;
  const page = req.body.page;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select("alerts _id")
    .slice("alerts", [10 * page, 10])
    .populate({
      path: "alerts.reserwationId",
      select:
        "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company",
      populate: {
        path: "company fromUser",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "alerts.serviceId",
      select:
        "_id objectName description userId companyId month year day createdAt",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "alerts.communitingId",
      select:
        "_id city description userId companyId month year day timeStart timeEnd",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .then((user) => {
      if (!!user) {
        res.status(200).json({
          newAllerts: user.alerts,
        });
      } else {
        res.status(422).json({
          message: "Brak użytkownika",
        });
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd serwera.";
      }
      next(err);
    });
};

exports.autoLogin = (req, res, next) => {
  const userId = req.body.userId;
  const token = req.body.token;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
    loginToken: token,
  })
    .select(
      "_id loginToken blockUserSendVerifiedPhoneSms blockUserChangePhoneNumber phoneVerified favouritesCompanys stamps company alerts name surname alertActiveCount email accountVerified imageUrl hasPhone imageOther"
    )
    .slice("alerts", 10)
    .populate("favouritesCompanys", "_id linkPath name")
    .populate(
      "stamps.reserwations",
      "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company visitCanceled fullDate"
    )
    .populate(
      "stamps.companyId",
      "_id linkPath companyStamps services.serviceName services._id name"
    )
    .populate(
      "allCompanys",
      "accountVerified allDataVerified owner pauseCompany name workers._id workers.user workers.permissions sms premium"
    )
    .populate({
      path: "alerts.reserwationId",
      select:
        "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company",
      populate: {
        path: "company fromUser",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "alerts.serviceId",
      select:
        "_id objectName description userId companyId month year day createdAt",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "alerts.communitingId",
      select:
        "_id city description userId companyId month year day timeStart timeEnd",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .then((user) => {
      if (!!user) {
        const userName = Buffer.from(user.name, "base64").toString("utf-8");
        const userSurname = Buffer.from(user.surname, "base64").toString(
          "utf-8"
        );
        let validUserActiveCount = 0;
        if (!!user.alertActiveCount) {
          if (user.alertActiveCount > 0) {
            validUserActiveCount = user.alertActiveCount;
          }
        }
        const isNotCompanyStamps = user.stamps.some((stamp) => {
          const isInReserwationsStampsCanceled = stamp.reserwations.some(
            (itemStamp) => itemStamp.visitCanceled
          );
          return stamp.companyId === null || isInReserwationsStampsCanceled;
        });
        const isNotCompanyFavourites = user.favouritesCompanys.some(
          (fav) => fav === null
        );
        if (isNotCompanyStamps || isNotCompanyFavourites) {
          if (isNotCompanyStamps) {
            const newUserStamps = [];
            user.stamps.forEach((stamp) => {
              if (stamp.companyId !== null) {
                const filterCompanyNoActiveStamps = stamp.reserwations.filter(
                  (itemStamp) => !itemStamp.visitCanceled
                );
                stamp.reserwations = filterCompanyNoActiveStamps;
                newUserStamps.push({
                  _id: stamp._id,
                  reserwations: filterCompanyNoActiveStamps,
                  companyId: stamp.companyId,
                });
              }
            });
            user.stamps = newUserStamps;
          }
          if (isNotCompanyFavourites) {
            const filterFavUser = user.favouritesCompanys.filter(
              (fav) => fav !== null
            );
            user.favouritesCompanys = filterFavUser;
          }
          user.save();
        }
        let findCompanyInAllCompanys = null;
        if (!!user.company) {
          findCompanyInAllCompanys = user.allCompanys.find((itemCompany) => {
            return itemCompany._id.toString() == user.company.toString();
          });
        }

        // const params = {
        //   PhoneNumber: "+48515873009",
        //   Message: `Kod potwierdzający numer telefonu: $`,
        //   MessageStructure: "string",
        //   MessageAttributes: {
        //     "AWS.SNS.SMS.SenderID": {
        //       DataType: "String",
        //       StringValue: "Meetsy",
        //     },
        //     // "AWS.SNS.SMS.SMSType": {
        //     //   DataType: "String",
        //     //   StringValue: "Transactional",
        //     //   // StringValue: "Promotional",
        //     // },
        //   },
        // };

        // sns.publish(params, function (err, data) {
        //   if (err) console.log(err, err.stack);
        //   else console.log(data);
        // });

        res.status(200).json({
          userId: user._id.toString(),
          email: user.email,
          token: user.loginToken,
          accountVerified: user.accountVerified,
          userName: userName,
          userSurname: userSurname,
          company: !!findCompanyInAllCompanys
            ? findCompanyInAllCompanys
            : user.allCompanys.length > 0
            ? user.allCompanys[0]
            : null,
          defaultCompany: !!user.company
            ? user.company
            : user.allCompanys.length > 0
            ? user.allCompanys[0]._id
            : null,
          allCompanys: user.allCompanys,
          alerts: user.alerts,
          alertActiveCount: validUserActiveCount,
          imageUrl: !!user.imageOther ? user.imageOther : user.imageUrl,
          hasPhone: user.hasPhone,
          stamps: user.stamps,
          favouritesCompanys: user.favouritesCompanys,
          phoneVerified: user.phoneVerified,
          blockUserChangePhoneNumber: user.blockUserChangePhoneNumber,
          blockUserSendVerifiedPhoneSms: user.blockUserSendVerifiedPhoneSms,
          vapidPublic: PUBLIC_KEY_VAPID,
        });
      } else {
        res.status(422).json({
          message: "Brak użytkownika",
        });
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd serwera";
      }
      next(err);
    });
};

exports.edit = (req, res, next) => {
  const userId = req.userId;
  const password = req.body.password;
  const newPassword = req.body.newPassword ? req.body.newPassword : null;
  const newPhone = req.body.newPhone ? req.body.newPhone : null;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select(
      "_id phoneVerified blockUserSendVerifiedPhoneSms blockUserChangePhoneNumber password email loginToken phone name surname accountVerified company codeVerifiedPhoneDate codeVerifiedPhone whiteListVerifiedPhones"
    )
    .then((user) => {
      if (!!user) {
        return bcrypt
          .compare(password, user.password)
          .then((doMatch) => {
            if (!!doMatch) {
              if (!!newPhone || !!newPassword) {
                const token = jwt.sign(
                  {
                    email: user.email,
                    userId: user._id.toString(),
                  },
                  TOKEN_PASSWORD,
                  {
                    expiresIn: BCRIPT_EXPIRES_IN,
                  }
                );
                user.loginToken = token;
                if (!!newPhone) {
                  const validBlockUserChangePhoneNumber =
                    !!user.blockUserChangePhoneNumber
                      ? user.blockUserChangePhoneNumber
                      : null;
                  if (validBlockUserChangePhoneNumber <= new Date()) {
                    const hashedPhoneNumber = Buffer.from(
                      newPhone,
                      "utf-8"
                    ).toString("base64");
                    return User.countDocuments({
                      phone: hashedPhoneNumber,
                    }).then((countUsersPhone) => {
                      if (!!!countUsersPhone) {
                        const isPhoneInWhiteList =
                          user.whiteListVerifiedPhones.some(
                            (item) => item === hashedPhoneNumber
                          );
                        if (isPhoneInWhiteList) {
                          user.phoneVerified = true;
                        } else {
                          const randomCode = makeid(6);
                          const dateVerifiedPhoneCompany = new Date(
                            new Date().setHours(new Date().getHours() + 1)
                          );
                          const hashedCodeToVerifiedPhone = Buffer.from(
                            randomCode,
                            "utf-8"
                          ).toString("base64");
                          user.phoneVerified = false;
                          user.codeVerifiedPhoneDate = dateVerifiedPhoneCompany;
                          user.codeVerifiedPhone = hashedCodeToVerifiedPhone;
                        }
                        user.blockUserChangePhoneNumber = new Date(
                          new Date().setHours(new Date().getHours() + 1)
                        );
                        user.blockUserSendVerifiedPhoneSms = new Date(
                          new Date().setHours(new Date().getHours() + 1)
                        );
                        user.phone = hashedPhoneNumber;
                        user.hasPhone = true;
                        return user.save();
                      } else {
                        const error = new Error("Numer telefonu jest zajęty");
                        error.statusCode = 442;
                        throw error;
                      }
                    });
                  } else {
                    const error = new Error(
                      "Nie można teraz zmienić numeru telefonu"
                    );
                    error.statusCode = 423;
                    throw error;
                  }
                }
                if (!!newPassword) {
                  return bcrypt
                    .hash(newPassword, Number(BCRIPT_SECURITY_VALUE))
                    .then((hashedPassword) => {
                      if (hashedPassword) {
                        user.password = hashedPassword;
                        return user.save();
                      }
                    })
                    .catch(() => {
                      if (!err.statusCode) {
                        const error = new Error("Coś poszło nie tak");
                        error.statusCode = 501;
                        throw error;
                      }
                      next(err);
                    });
                }
              } else {
                const error = new Error("Brak nowych danych");
                error.statusCode = 502;
                throw error;
              }
            } else {
              const error = new Error("Błędne hasło");
              error.statusCode = 401;
              throw error;
            }
          })
          .then((userSavedData) => {
            if (!!!userSavedData.phoneVerified) {
              const userName = Buffer.from(
                userSavedData.name,
                "base64"
              ).toString("utf-8");
              const userSurname = Buffer.from(
                userSavedData.surname,
                "base64"
              ).toString("utf-8");
              const codeToDelete = Buffer.from(
                userSavedData.codeVerifiedPhone,
                "base64"
              ).toString("utf-8");

              // const params = {
              //   Message: `Kod potwierdzający numer telefonu: ${codeToDelete.toUpperCase()}`,
              //   MessageStructure: "string",
              //   PhoneNumber: "+48515873009",
              //   MessageAttributes: {
              //     "AWS.SNS.SMS.SenderID": {
              //       DataType: "String",
              //       StringValue: "Meetsy",
              //     },
              //   },
              // };
              // sns.publish(params, function (err, data) {
              //   if (err) console.log(err, err.stack);
              //   else console.log(data);
              // });

              transporter.sendMail({
                to: userSavedData.email,
                from: MAIL_INFO,
                subject: `Potwierdzenie numeru telefonu ${userName} ${userSurname}`,
                html: `<h1>Kod potwierdzający numer telefonu: ${codeToDelete.toUpperCase()}</h1>`,
              });
            }
            return userSavedData;
          })
          .then((result) => {
            const userPhone = !!result.phone
              ? Buffer.from(result.phone, "base64").toString("utf-8")
              : null;
            transporter.sendMail({
              to: result.email,
              from: MAIL_INFO,
              subject: "Edycja konta zakończone powodzeniem",
              html: `<h1>Edycja konta zakończona pomyślnie</h1>`,
            });
            res.status(201).json({
              email: result.email,
              token: result.loginToken,
              userPhone: userPhone,
              phoneVerified: result.phoneVerified,
              hasPhone: result.hasPhone,
              blockUserChangePhoneNumber: result.blockUserChangePhoneNumber,
              blockUserSendVerifiedPhoneSms:
                result.blockUserSendVerifiedPhoneSms,
            });
          })
          .catch((err) => {
            if (!err.statusCode) {
              const error = new Error("Błędne hasła");
              error.statusCode = 501;
              throw error;
            }
            next(err);
          });
      } else {
        const error = new Error("Brak użytkownika");
        error.statusCode = 412;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        const error = new Error("Błąd serwera");
        error.statusCode = 501;
        throw error;
      }
      next(err);
    });
};

exports.sentEmailResetPassword = (req, res, next) => {
  const email = req.body.email;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    email: email,
  })
    .select("email codeToResetPassword dateToResetPassword")
    .then((user) => {
      if (!!user) {
        const codeToReset = makeid(6);
        const hashedResetCode = Buffer.from(
          codeToReset.toUpperCase(),
          "utf-8"
        ).toString("base64");
        const dateResetPassword = new Date(
          new Date().setMinutes(new Date().getMinutes() + 30)
        );
        user.codeToResetPassword = hashedResetCode;
        user.dateToResetPassword = dateResetPassword;
        return user.save();
      }
    })
    .then((result) => {
      const codeToResetPassword = Buffer.from(
        result.codeToResetPassword,
        "base64"
      ).toString("utf-8");
      const showDate = `${result.dateToResetPassword.getFullYear()}-${
        result.dateToResetPassword.getMonth() + 1 < 10
          ? `0${result.dateToResetPassword.getMonth() + 1}`
          : result.dateToResetPassword.getMonth() + 1
      }-${
        result.dateToResetPassword.getDate() < 10
          ? `0${result.dateToResetPassword.getDate()}`
          : result.dateToResetPassword.getDate()
      } ${
        result.dateToResetPassword.getHours() < 10
          ? `0${result.dateToResetPassword.getHours()}`
          : result.dateToResetPassword.getHours()
      }:${
        result.dateToResetPassword.getMinutes() < 10
          ? `0${result.dateToResetPassword.getMinutes()}`
          : result.dateToResetPassword.getMinutes()
      }`;
      transporter.sendMail({
        to: result.email,
        from: MAIL_INFO,
        subject: "Kod z kodem resetującym hasło na Meetsy",
        html: `<h1>Kod resetujący hasło</h1> ${codeToResetPassword}.
        <h2>Data wygaśnięcia kodu: ${showDate}</h2>`,
      });

      res.status(200).json({
        message: "Email sent",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd serwera";
      }
      next(err);
    });
};

exports.resetPassword = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const codeReset = req.body.codeReset;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const codeToResetPassword = Buffer.from(codeReset, "utf-8").toString(
    "base64"
  );

  User.findOne({
    email: email,
    codeToResetPassword: codeToResetPassword,
  })
    .select(
      "email codeToResetPassword _id loginToken password dateToResetPassword"
    )
    .then((user) => {
      if (!!user) {
        if (user.dateToResetPassword > new Date()) {
          return bcrypt
            .hash(password, Number(BCRIPT_SECURITY_VALUE))
            .then((hashedPassword) => {
              if (hashedPassword) {
                const token = jwt.sign(
                  {
                    email: user.email,
                    userId: user._id.toString(),
                  },
                  TOKEN_PASSWORD,
                  {
                    expiresIn: BCRIPT_EXPIRES_IN,
                  }
                );
                user.loginToken = token;
                user.codeToResetPassword = null;
                user.password = hashedPassword;
                return user.save();
              }
            });
        } else {
          const error = new Error("Kod resetujący hasło wygasł.");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error(
          "Brak użytkownika, lub kod resetujący jest błędny."
        );
        error.statusCode = 502;
        throw error;
      }
    })
    .then((result) => {
      transporter.sendMail({
        to: result.email,
        from: MAIL_INFO,
        subject: "Tworzenie konta zakończone powodzeniem",
        html: `<h1>Hasło zostało zmienione</h1>`,
      });
      res.status(200).json({
        message: "Hasło zostało zmienione",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd serwera";
      }
      next(err);
    });
};

exports.userUploadImage = (req, res, next) => {
  const userId = req.userId;
  const image = req.body.image;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  User.findOne({
    _id: userId,
  })
    .select("_id imageUrl")
    .then((userDoc) => {
      if (!!userDoc) {
        return getImageUrl("avatars", image).then((result) => {
          userDoc.imageUrl = result;
          userDoc.save();
          return result;
        });
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((imageUrl) => {
      res.status(201).json({
        imageUrl: imageUrl,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.userDeleteImage = (req, res, next) => {
  const userId = req.userId;
  const imagePath = req.body.imagePath;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  User.findOne({
    _id: userId,
  })
    .select("_id imageUrl")
    .then((userDoc) => {
      if (!!userDoc) {
        return s3Bucket.deleteObject(
          {
            Bucket: AWS_BUCKET,
            Key: imagePath,
          },
          function (err, data) {
            if (err) {
              res.status(500).send(error);
            } else {
              userDoc.imageUrl = "";
              return userDoc.save();
            }
          }
        );
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 502;
        throw error;
      }
    })
    .then(() => {
      res.status(201).json({
        message: "Usunięto zdjęcie",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.userDeleteImageOther = (req, res, next) => {
  const userId = req.userId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  User.findOne({
    _id: userId,
  })
    .select("_id imageUrl")
    .then((userDoc) => {
      if (!!userDoc) {
        userDoc.imageUrl = "";
        userDoc.imageOther = "";
        return userDoc.save();
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 502;
        throw error;
      }
    })
    .then(() => {
      res.status(201).json({
        message: "Usunięto zdjęcie",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.loginFacebookNew = (req, res, next) => {
  const {
    // _json: { email, name, picture },
    _json: { email, name },
  } = req.user.profile;
  User.findOne({
    email: email,
  })
    .select("email _id loginToken")
    .then((userDoc) => {
      if (!!userDoc) {
        const token = jwt.sign(
          {
            email: userDoc.email,
            userId: userDoc._id.toString(),
          },
          TOKEN_PASSWORD,
          {
            expiresIn: BCRIPT_EXPIRES_IN,
          }
        );
        userDoc.loginToken = token;
        return userDoc
          .save()
          .then((resultSaved) => {
            res.redirect(
              303,
              `${SITE_FRONT}/login-facebook?${resultSaved.loginToken}&${resultSaved._id}&false`
            );
          })
          .catch(() => {
            const error = new Error("Coś poszło nie tak.");
            error.statusCode = 422;
            throw error;
          });
      } else {
        const splitUserName = name.split(" ");
        const randomPassword = makeid(10);
        if (!!email) {
          return bcrypt
            .hash(randomPassword, Number(BCRIPT_EXPIRES_IN))
            .then((hashedPassword) => {
              if (!!hashedPassword) {
                const hashedUserName = Buffer.from(
                  splitUserName[0],
                  "utf-8"
                ).toString("base64");

                const hashedUserSurname = Buffer.from(
                  splitUserName[1],
                  "utf-8"
                ).toString("base64");

                const user = new User({
                  email: email,
                  name: hashedUserName,
                  surname: hashedUserSurname,
                  password: hashedPassword,
                  phone: null,
                  accountVerified: true,
                  codeToVerified: null,
                  hasPhone: false,
                  // imageOther: !!picture ? picture.data.url : "",
                  company: null,
                  allCompanys: [],
                  phoneVerified: false,
                  stamps: [],
                  alerts: [],
                });
                const token = jwt.sign(
                  {
                    email: email,
                    userId: user._id.toString(),
                  },
                  TOKEN_PASSWORD,
                  {
                    expiresIn: BCRIPT_EXPIRES_IN,
                  }
                );
                user.loginToken = token;
                user.save((err, userSaved) => {
                  if (!!!err) {
                    transporter.sendMail({
                      to: userSaved.email,
                      from: MAIL_INFO,
                      subject: "Tworzenie konta zakończone powodzeniem",
                      html: `<h1>Utworzono nowe konto za pomocą facebook-a</h1>
                      <p>Twoje nowe wygenerowane hasło to: <b>${randomPassword}</b>. Możesz go zmienić w ustawieniach konta na stronie nootis.pl</p>`,
                    });
                    res.redirect(
                      303,
                      `${SITE_FRONT}/login-facebook?${userSaved.loginToken}&${userSaved._id}&true`
                    );
                  } else {
                    const error = new Error(
                      "Błąd podczas logowania użytkownika"
                    );
                    error.statusCode = 422;
                    throw error;
                  }
                });
              }
            });
        } else {
          const error = new Error("Coś poszło nie tak.");
          error.statusCode = 422;
          throw error;
        }
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.addCompanyFavourites = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.updateOne(
    {
      _id: userId,
    },
    {
      $addToSet: {
        favouritesCompanys: companyId,
      },
    }
  )
    .then(() => {
      res.status(201).json({
        message: "Dodano do ulubionych",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.deleteCompanyFavourites = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.updateOne(
    {
      _id: userId,
    },
    {
      $pull: {
        favouritesCompanys: companyId,
      },
    }
  )
    .then(() => {
      res.status(201).json({
        message: "Usunięto z ulubionych",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.loginGoogle = (req, res, next) => {
  const {
    // _json: { email, name, picture },
    _json: { email, name },
  } = req.user.profile;
  User.findOne({
    email: email,
  })
    .select("email _id loginToken")
    .then((userDoc) => {
      if (!!userDoc) {
        const token = jwt.sign(
          {
            email: userDoc.email,
            userId: userDoc._id.toString(),
          },
          TOKEN_PASSWORD,
          {
            expiresIn: BCRIPT_EXPIRES_IN,
          }
        );
        userDoc.loginToken = token;
        return userDoc
          .save()
          .then((resultSaved) => {
            res.redirect(
              303,
              `${SITE_FRONT}/login-google?${resultSaved.loginToken}&${resultSaved._id}&false`
            );
          })
          .catch(() => {
            const error = new Error("Coś poszło nie tak.");
            error.statusCode = 422;
            throw error;
          });
      } else {
        const splitUserName = name.split(" ");
        const randomPassword = makeid(10);
        if (!!email) {
          return bcrypt
            .hash(randomPassword, Number(BCRIPT_EXPIRES_IN))
            .then((hashedPassword) => {
              if (!!hashedPassword) {
                const hashedUserName = Buffer.from(
                  splitUserName[0],
                  "utf-8"
                ).toString("base64");

                const hashedUserSurname = Buffer.from(
                  splitUserName[1],
                  "utf-8"
                ).toString("base64");

                const user = new User({
                  email: email,
                  name: hashedUserName,
                  surname: hashedUserSurname,
                  password: hashedPassword,
                  phone: null,
                  accountVerified: true,
                  codeToVerified: null,
                  hasPhone: false,
                  // imageOther: !!picture ? picture : "",
                  company: null,
                  allCompanys: [],
                  phoneVerified: false,
                  stamps: [],
                  alerts: [],
                });
                const token = jwt.sign(
                  {
                    email: email,
                    userId: user._id.toString(),
                  },
                  TOKEN_PASSWORD,
                  {
                    expiresIn: BCRIPT_EXPIRES_IN,
                  }
                );
                user.loginToken = token;
                user.save((err, userSaved) => {
                  if (!!!err) {
                    transporter.sendMail({
                      to: userSaved.email,
                      from: MAIL_INFO,
                      subject: "Tworzenie konta zakończone powodzeniem",
                      html: `<h1>Utworzono nowe konto za pomocą googla</h1>
                      <p>Twoje nowe wygenerowane hasło to: <b>${randomPassword}</b>. Możesz go zmienić w ustawieniach konta na stronie nootis.pl</p>`,
                    });
                    res.redirect(
                      303,
                      `${SITE_FRONT}/login-google?${userSaved.loginToken}&${userSaved._id}&true`
                    );
                  } else {
                    const error = new Error(
                      "Błąd podczas logowania użytkownika"
                    );
                    error.statusCode = 422;
                    throw error;
                  }
                });
              }
            });
        } else {
          const error = new Error("Coś poszło nie tak.");
          error.statusCode = 422;
          throw error;
        }
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.userSentCodeDeleteCompany = (req, res, next) => {
  const userId = req.userId;

  User.findOne({
    _id: userId,
  })
    .select("_id codeDeleteDate codeDelete name surname email allCompanys")
    .then((resultUserDoc) => {
      if (!!resultUserDoc) {
        if (resultUserDoc.allCompanys.length === 0) {
          const randomCode = makeid(10);
          const dateDeleteCompany = new Date(
            new Date().setMinutes(new Date().getMinutes() + 30)
          );
          const hashedCodeToDelete = Buffer.from(randomCode, "utf-8").toString(
            "base64"
          );
          resultUserDoc.codeDeleteDate = dateDeleteCompany;
          resultUserDoc.codeDelete = hashedCodeToDelete;
          return resultUserDoc.save();
        } else {
          const error = new Error(
            "Nie można usunąć konta, które przynależy do działalności."
          );
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((userSavedData) => {
      const userName = Buffer.from(userSavedData.name, "base64").toString(
        "utf-8"
      );
      const userSurname = Buffer.from(userSavedData.surname, "base64").toString(
        "utf-8"
      );
      const codeToDelete = Buffer.from(
        userSavedData.codeDelete,
        "base64"
      ).toString("utf-8");
      transporter.sendMail({
        to: userSavedData.email,
        from: MAIL_INFO,
        subject: `Potwierdzenie usunięcia konta ${userName} ${userSurname}`,
        html: `<h1>Kod do usunięcia konta: ${codeToDelete.toUpperCase()}</h1>`,
      });
      res.status(201).json({
        message: "Wysłano kod do usunięcia konta",
      });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas wysyłania kodu do usunięcia konta.";
      }
      next(err);
    });
};

exports.userSentCodeVerifiedPhone = (req, res, next) => {
  const userId = req.userId;

  User.findOne({
    _id: userId,
  })
    .select(
      "_id blockUserSendVerifiedPhoneSms codeVerifiedPhoneDate codeVerifiedPhone name surname email"
    )
    .then((resultUserDoc) => {
      if (!!resultUserDoc) {
        const validBlockUserSendVerifiedPhoneSms =
          !!resultUserDoc.blockUserSendVerifiedPhoneSms
            ? resultUserDoc.blockUserSendVerifiedPhoneSms
            : null;
        if (validBlockUserSendVerifiedPhoneSms <= new Date()) {
          const randomCode = makeid(6);
          const dateDeleteCompany = new Date(
            new Date().setMinutes(new Date().getMinutes() + 30)
          );
          const hashedCodeToDelete = Buffer.from(randomCode, "utf-8").toString(
            "base64"
          );
          resultUserDoc.codeVerifiedPhoneDate = dateDeleteCompany;
          resultUserDoc.codeVerifiedPhone = hashedCodeToDelete;
          resultUserDoc.blockUserSendVerifiedPhoneSms = new Date(
            new Date().setHours(new Date().getHours() + 1)
          );
          return resultUserDoc.save();
        } else {
          const error = new Error(
            "Nie można wysłać ponownie wiadomość do aktywcji numeru telefonu"
          );
          error.statusCode = 423;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((userSavedData) => {
      const userName = Buffer.from(userSavedData.name, "base64").toString(
        "utf-8"
      );
      const userSurname = Buffer.from(userSavedData.surname, "base64").toString(
        "utf-8"
      );
      const codeToDelete = Buffer.from(
        userSavedData.codeVerifiedPhone,
        "base64"
      ).toString("utf-8");

      const params = {
        Message: `Kod potwierdzenia telefonu: ${codeToDelete.toUpperCase()}`,
        MessageStructure: "string",
        PhoneNumber: "+48515873009",
        MessageAttributes: {
          "AWS.SNS.SMS.SenderID": {
            DataType: "String",
            StringValue: "Meetsy",
          },
        },
      };
      /*
      sns.publish(params, function (err, data) {
        if (err) console.log(err, err.stack);
        else console.log(data);
      });*/

      transporter.sendMail({
        to: userSavedData.email,
        from: MAIL_INFO,
        subject: `Potwierdzenie numeru telefonu ${userName} ${userSurname}`,
        html: `<h1>Kod potwierdzenia telefonu: ${codeToDelete.toUpperCase()}</h1>`,
      });
      res.status(201).json({
        blockUserSendVerifiedPhoneSms:
          userSavedData.blockUserSendVerifiedPhoneSms,
      });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas wysyłania kodu do potwierdzenia telefonu.";
      }
      next(err);
    });
};

exports.deleteUserAccount = (req, res, next) => {
  const userId = req.userId;
  const code = req.body.code;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  User.findOne({
    _id: userId,
  })
    .select("_id codeDeleteDate codeDelete name surname email allCompanys")
    .then((userData) => {
      if (!!userData) {
        if (userData.allCompanys.length === 0) {
          const codeToDelete = Buffer.from(
            userData.codeDelete,
            "base64"
          ).toString("utf-8");
          if (
            code.toUpperCase() === codeToDelete.toUpperCase() &&
            userData.codeDeleteDate > new Date()
          ) {
            return true;
          } else {
            const error = new Error("Błędny kod.");
            error.statusCode = 422;
            throw error;
          }
        } else {
          const error = new Error(
            "Nie można usunąć konta, które przynależy do działalności."
          );
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then(() => {
      return Reserwation.aggregate([
        {
          $match: {
            fromUser: mongoose.Types.ObjectId(userId),
            isDraft: { $in: [false, null] },
            visitNotFinished: false,
            visitCanceled: false,
            fullDate: {
              $gte: new Date(),
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "toWorkerUserId",
            foreignField: "_id",
            as: "toWorkerUserId",
          },
        },
        { $unwind: "$toWorkerUserId" },
        {
          $lookup: {
            from: "users",
            localField: "fromUser",
            foreignField: "_id",
            as: "fromUser",
          },
        },
        { $unwind: "$fromUser" },
        {
          $lookup: {
            from: "companys",
            localField: "company",
            foreignField: "_id",
            as: "company",
          },
        },
        { $unwind: "$company" },
        {
          $sort: { fullDate: 1 },
        },
        {
          $project: {
            _id: 1,
            fromUser: {
              name: 1,
              surname: 1,
              _id: 1,
            },
            company: {
              name: 1,
              _id: 1,
              linkPath: 1,
            },
            toWorkerUserId: {
              name: 1,
              _id: 1,
              surname: 1,
            },
            dateYear: 1,
            dateMonth: 1,
            dateDay: 1,
            dateStart: 1,
            dateEnd: 1,
            serviceName: 1,
            visitNotFinished: 1,
            visitCanceled: 1,
            visitChanged: 1,
            workerReserwation: 1,
            fullDate: 1,
          },
        },
      ]).then((allWorkerReserwations) => {
        const allUsersReserwations = [];
        const bulkArrayToUpdate = [];
        if (!!allWorkerReserwations) {
          allWorkerReserwations.forEach((item) => {
            bulkArrayToUpdate.push({
              updateOne: {
                filter: { _id: item._id },
                update: {
                  $set: {
                    visitCanceled: true,
                  },
                },
              },
            });

            const findUserReserwations = allUsersReserwations.findIndex(
              (reserwation) => {
                return (
                  reserwation.userId.toString() ==
                  item.toWorkerUserId.toString()
                );
              }
            );
            if (findUserReserwations >= 0) {
              allUsersReserwations[findUserReserwations].items.push(item);
            } else {
              const newUserData = {
                userId: item.toWorkerUserId,
                items: [item],
              };
              allUsersReserwations.push(newUserData);
            }
          });
        }
        return Reserwation.bulkWrite(bulkArrayToUpdate)
          .then(() => {
            return allUsersReserwations;
          })
          .catch((err) => {
            if (!err.statusCode) {
              err.statusCode = 501;
              err.message = "Błąd podczas aktualizacji rezerwacji.";
            }
            next(err);
          });
      });
    })
    .then((result) => {
      const bulkArrayToUpdate = [];
      result.forEach((userDoc) => {
        const allUserAlertsToSave = [];

        userDoc.items.forEach((itemReserwation) => {
          const userAlertToSave = {
            reserwationId: itemReserwation._id,
            active: true,
            type: "rezerwation_canceled",
            creationTime: new Date(),
            companyChanged: false,
          };

          io.getIO().emit(`user${userDoc.userId._id}`, {
            action: "update-alerts",
            alertData: {
              reserwationId: itemReserwation,
              active: true,
              type: "rezerwation_canceled",
              creationTime: new Date(),
              companyChanged: false,
            },
          });

          allUserAlertsToSave.unshift(userAlertToSave);
        });

        bulkArrayToUpdate.push({
          updateOne: {
            filter: {
              _id: userDoc.userId._id,
            },
            update: {
              $inc: { alertActiveCount: allUserAlertsToSave.length },
              $push: {
                alerts: {
                  $each: allUserAlertsToSave,
                  $position: 0,
                },
              },
            },
          },
        });
      });

      return User.bulkWrite(bulkArrayToUpdate)
        .then(() => {
          return true;
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas wysyłania powiadomień.";
          }
          next(err);
        });
    })
    .then(() => {
      return CompanyUsersInformations.deleteMany({ userId: userId });
    })
    .then(() => {
      return User.findOne({ _id: userId })
        .select("_id email")
        .then((userDoc) => {
          if (!!userDoc) {
            transporter.sendMail({
              to: userDoc.email,
              from: MAIL_INFO,
              subject: "Usunięto konto!",
              html: "<h1>Konto została usunięte</h1>",
            });
            return true;
          } else {
            const error = new Error("Błąd podczas usuwania konta.");
            error.statusCode = 423;
            throw error;
          }
        });
    })
    .then(() => {
      return User.deleteOne({ _id: userId });
    })
    .then(() => {
      res.status(201).json({
        message: "Użytkownik został usunięty",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas usuwania użytkownika.";
      }
      next(err);
    });
};

exports.verifiedUserPhone = (req, res, next) => {
  const userId = req.userId;
  const code = req.body.code;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  User.findOne({ _id: userId })
    .select(
      "_id codeVerifiedPhoneDate codeVerifiedPhone name surname email phoneVerified phone whiteListVerifiedPhones"
    )
    .then((userData) => {
      const codeToVerified = Buffer.from(
        userData.codeVerifiedPhone,
        "base64"
      ).toString("utf-8");
      if (
        code.toUpperCase() === codeToVerified.toUpperCase() &&
        userData.codeVerifiedPhoneDate > new Date()
      ) {
        return userData;
      } else {
        const error = new Error("Błędny kod.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((userData) => {
      userData.codeVerifiedPhoneDate = null;
      userData.codeVerifiedPhone = null;
      userData.phoneVerified = true;
      userData.whiteListVerifiedPhones.push(userData.phone);
      return userData.save();
    })
    .then((userDoc) => {
      transporter.sendMail({
        to: userDoc.email,
        from: MAIL_INFO,
        subject: "Zweryfikowano numer telefonu!",
        html: "<h1>Numer telefonu został zweryfikowany</h1>",
      });
      return true;
    })
    .then(() => {
      res.status(201).json({
        message: "Numer telefonu został zweryfikowany",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas weryfikowania numeru telefonu.";
      }
      next(err);
    });
};

exports.saveNotificationEndpoint = (req, res, next) => {
  const userId = req.userId;
  const endpoint = req.body.endpoint;

  User.findOne({
    _id: userId,
  })
    .select("_id vapidEndpoint")
    .then((resultUserDoc) => {
      if (!!resultUserDoc) {
        resultUserDoc.vapidEndpoint = endpoint;

        const params = {
          title: "Test podczas logowania",
          body: "Test podczas logowania body",
        };

        webpush
          .sendNotification(endpoint, JSON.stringify(params))
          .then(() => {})
          .catch(() => {});

        return resultUserDoc.save();
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas wysyłania kodu do usunięcia konta.";
      }
      next(err);
    });
};

exports.userUpdateDefaultCompany = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select("_id company allCompanys")
    .then((userData) => {
      if (!!userData) {
        const isInCompanys = userData.allCompanys.some(
          (item) => item == companyId
        );
        if (isInCompanys) {
          userData.company = companyId;
          return userData.save();
        } else {
          const error = new Error("Brak firmy");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika");
        error.statusCode = 422;
        throw error;
      }
    })
    .then(() => {
      res.status(201).json({
        message: "Zaktualizowano domyślną firmę",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danego konta firmowego";
      }
      next(err);
    });
};

exports.userHistoryServices = (req, res, next) => {
  const userId = req.userId;
  const month = req.body.month;
  const year = req.body.year;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select("_id")
    .then((userData) => {
      if (!!userData) {
        return Service.find({
          userId: userId,
          month: month,
          year: year,
          isDeleted: { $in: [false, null] },
        })
          .select(
            "_id companyId workerUserId userId objectName description cost statusValue dateStart dateService dateEnd createdAt updatedAt opinionId"
          )
          .populate("workerUserId", "name surname")
          .populate("companyId", "_id name linkPath")
          .populate("opinionId", "")
          .then((resultsServices) => {
            res.status(201).json({
              userServices: resultsServices,
            });
          });
      } else {
        const error = new Error("Brak użytkownika");
        error.statusCode = 422;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danego konta firmowego";
      }
      next(err);
    });
};

exports.userHistoryCommuniting = (req, res, next) => {
  const userId = req.userId;
  const month = req.body.month;
  const year = req.body.year;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select("_id")
    .then((userData) => {
      if (!!userData) {
        return Communiting.find({
          userId: userId,
          month: month,
          year: year,
          isDeleted: { $in: [false, null] },
        })
          .select(
            "_id year month day reserwationId opinionId companyId workerUserId userId description cost statusValue dateStartValid dateCommunitingValid dateEndValid timeStart timeEnd createdAt updatedAt city street"
          )
          .populate("workerUserId", "name surname")
          .populate("companyId", "_id name linkPath")
          .populate("opinionId", "")
          .then((resultsCommunitings) => {
            res.status(201).json({
              userCommuniting: resultsCommunitings,
            });
          });
      } else {
        const error = new Error("Brak użytkownika");
        error.statusCode = 422;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danego konta firmowego";
      }
      next(err);
    });
};

exports.userCancelCommuniting = (req, res, next) => {
  const userId = req.userId;
  const communityId = req.body.communityId;
  const reserwationId = req.body.reserwationId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select("_id")
    .then((userData) => {
      if (!!userData) {
        Reserwation.deleteOne({ _id: reserwationId }).then(() => {});
        return Communiting.updateOne(
          {
            _id: communityId,
            userId: userId,
          },
          {
            $set: {
              statusValue: 4,
            },
          }
        ).then(() => {
          return Communiting.findOne({
            _id: communityId,
            userId: userId,
          })
            .select(
              "_id city description userId companyId month year day timeStart timeEnd email"
            )
            .populate("companyId userId", "name surname linkPath")
            .then(async (resultSavetCommuniting) => {
              if (!!resultSavetCommuniting) {
                const emailContent = `<h1>Odwołano dojazd:</h1>
                      <h4>dojazd pod linkiem: xd</h4>`;

                const payload = {
                  title: `Odwołano dojazd dnia: ${resultSavetCommuniting.day}-${resultSavetCommuniting.month}-${resultSavetCommuniting.year}, o godzine: ${resultSavetCommuniting.timeStart}`,
                  body: "this is the body",
                  icon: "images/someImageInPath.png",
                };

                const emailSubject = `Odwołano dojazd`;

                const { notifactionDone } = await generateNotifications(
                  [
                    !!resultSavetCommuniting.userId
                      ? resultSavetCommuniting.userId._id
                      : null,
                    !!resultSavetCommuniting.workerUserId
                      ? resultSavetCommuniting.workerUserId._id
                      : null,
                  ],
                  resultSavetCommuniting,
                  "commuting_canceled",
                  [emailSubject, emailContent],
                  payload,
                  null,
                  !!resultSavetCommuniting.userId
                    ? resultSavetCommuniting.userId._id
                    : null,
                  !!resultSavetCommuniting.email
                    ? resultSavetCommuniting.email
                    : null,
                  "communitingId"
                );
                if (notifactionDone) {
                  res.status(200).json({
                    message: "Odwołano dojazd",
                  });
                }
              }
            });
        });
      } else {
        const error = new Error("Brak użytkownika");
        error.statusCode = 422;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danego konta firmowego";
      }
      next(err);
    });
};
