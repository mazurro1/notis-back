const User = require("../models/user");
const Alert = require("../models/alert");
const Company = require("../models/company");
const Reserwation = require("../models/reserwation");
const Service = require("../models/service");
const Communiting = require("../models/Communiting");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const AWS = require("aws-sdk");
const io = require("../socket");
const getImgBuffer = require("../getImgBuffer");
const notifications = require("../middleware/notifications");
const generateEmail = require("../middleware/generateContentEmail");

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
  PUBLIC_KEY_VAPID,
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
  const email = req.body.email.toLowerCase();
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
                      language: "PL",
                      darkMode: false,
                      blindMode: false,
                      emailVerified: false,
                      emailToVerified: null,
                      blockUserChangeEmail: new Date(),
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

      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_create_account",
        companyChanged: false,
        language: "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: result.email,
        title: propsGenerator.title,
        defaultText: `${propsGenerator.title} ${unhashedCodeToVerified}`,
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
  const email = req.body.email.toLowerCase();
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
      "darkMode blindMode language email blockUserSendVerifiedPhoneSms emailVerified emailToVerified blockUserChangeEmail blockUserChangePhoneNumber _id phoneVerified imageUrl hasPhone name surname favouritesCompanys company stamps loginToken password codeToResetPassword token accountVerified alertActiveCount imageOther"
    )
    .populate("favouritesCompanys", "_id linkPath name")
    .populate(
      "allCompanys",
      "accountPhoneVerified phoneToVeryfied emailToVeryfied blockSendVerifiedEmail sharePhone blockSendVerifiedPhoneSms accountEmailVerified allDataVerified owner pauseCompany name workers._id workers.user workers.permissions sms premium"
    )
    .populate(
      "stamps.companyId",
      "_id linkPath companyStamps services.serviceName services._id name "
    )
    .populate(
      "stamps.reserwations",
      "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company visitCanceled fullDate oldReserwationId"
    )
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
            return Alert.find({
              toUserId: user._id,
            })
              .sort({ createdAt: -1 })
              .limit(10)
              .populate("alertDefaultCompanyId", "_id name linkPath")
              .populate({
                path: "reserwationId",
                select:
                  "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company oldReserwationId name surname",
                populate: {
                  path: "company fromUser",
                  select: "name surname linkPath",
                },
              })
              .populate({
                path: "serviceId",
                select:
                  "_id objectName description userId companyId month year day createdAt",
                populate: {
                  path: "companyId userId",
                  select: "name surname linkPath",
                },
              })
              .populate({
                path: "communitingId",
                select:
                  "_id city description userId companyId month year day timeStart timeEnd",
                populate: {
                  path: "companyId userId",
                  select: "name surname linkPath",
                },
              })
              .then((userAlerts) => {
                return Alert.countDocuments({
                  toUserId: user._id,
                  active: true,
                }).then((activeUserAllerts) => {
                  let validUserActiveCount = 0;
                  if (!!activeUserAllerts) {
                    if (activeUserAllerts > 0) {
                      validUserActiveCount = activeUserAllerts;
                    }
                  }

                  const userName = Buffer.from(
                    userWithToken.name,
                    "base64"
                  ).toString("utf-8");
                  const userSurname = Buffer.from(
                    userWithToken.surname,
                    "base64"
                  ).toString("utf-8");

                  const isNotCompanyStamps = userWithToken.stamps.some(
                    (stamp) => stamp.companyId === null
                  );
                  const isNotCompanyFavourites =
                    userWithToken.favouritesCompanys.some(
                      (fav) => fav === null
                    );
                  if (isNotCompanyStamps || isNotCompanyFavourites) {
                    if (isNotCompanyStamps) {
                      const filterStampsUser = userWithToken.stamps.filter(
                        (stamp) => stamp.companyId !== null
                      );
                      userWithToken.stamps = filterStampsUser;
                    }
                    if (isNotCompanyFavourites) {
                      const filterFavUser =
                        userWithToken.favouritesCompanys.filter(
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
                    alerts: !!userAlerts ? userAlerts : [],
                    alertActiveCount: validUserActiveCount,
                    imageUrl: !!user.imageOther
                      ? user.imageOther
                      : user.imageUrl,
                    hasPhone: user.hasPhone,
                    stamps: user.stamps,
                    favouritesCompanys: user.favouritesCompanys,
                    phoneVerified: user.phoneVerified,
                    blockUserChangePhoneNumber: user.blockUserChangePhoneNumber,
                    emailVerified: user.emailVerified,
                    emailToVerified: user.emailToVerified,
                    blockUserChangeEmail: user.blockUserChangeEmail,
                    blockUserSendVerifiedPhoneSms:
                      user.blockUserSendVerifiedPhoneSms,
                    vapidPublic: PUBLIC_KEY_VAPID,
                    language: !!user.language ? user.language : "pl",
                    darkMode: !!user.darkMode ? user.darkMode : false,
                    blindMode: !!user.blindMode ? user.blindMode : false,
                  });
                });
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

        const propsGenerator = generateEmail.generateContentEmail({
          alertType: "alert_create_account",
          companyChanged: false,
          language: "PL",
          itemAlert: null,
          collection: "Default",
        });

        notifications.sendEmail({
          email: user.email,
          title: propsGenerator.title,
          defaultText: `${propsGenerator.title} ${unhashedCodeToVerified}`,
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
    .select("_id phone phoneVerified whiteListVerifiedPhones")
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
          const userPhone = Buffer.from(selectedPhoneNumber, "base64").toString(
            "utf-8"
          );
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
          user.emailVerified = true;
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
      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_confirm_account",
        companyChanged: false,
        language: "PL",
        itemAlert: null,
        collection: "Default",
      });
      notifications.sendEmail({
        email: result.email,
        ...propsGenerator,
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

  Alert.updateMany(
    {
      toUserId: userId,
      active: true,
    },
    { $set: { active: false } }
  )
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

  Alert.find({
    toUserId: userId,
  })
    .sort({ createdAt: -1 })
    .skip((page - 1) * 10)
    .limit(10)
    .populate("alertDefaultCompanyId", "_id name linkPath")
    .populate({
      path: "reserwationId",
      select:
        "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company oldReserwationId name surname",
      populate: {
        path: "company fromUser",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "serviceId",
      select:
        "_id objectName description userId companyId month year day createdAt",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "communitingId",
      select:
        "_id city description userId companyId month year day timeStart timeEnd",
      populate: {
        path: "companyId userId",
        select: "name surname linkPath",
      },
    })
    .then((newAlerts) => {
      res.status(200).json({
        newAllerts: !!newAlerts ? newAlerts : [],
      });
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
      "_id darkMode blindMode language loginToken blockUserSendVerifiedPhoneSms emailVerified emailToVerified blockUserChangeEmail blockUserChangePhoneNumber phoneVerified favouritesCompanys stamps company name surname alertActiveCount email accountVerified imageUrl hasPhone imageOther"
    )
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
      "accountPhoneVerified phoneToVeryfied emailToVeryfied blockSendVerifiedEmail sharePhone blockSendVerifiedPhoneSms accountEmailVerified allDataVerified owner pauseCompany name workers._id workers.user workers.permissions sms premium"
    )
    .then((user) => {
      if (!!user) {
        return Alert.find({
          toUserId: user._id,
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate("alertDefaultCompanyId", "_id name linkPath")
          .populate({
            path: "reserwationId",
            select:
              "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company oldReserwationId name surname",
            populate: {
              path: "company fromUser",
              select: "name surname linkPath",
            },
          })
          .populate({
            path: "serviceId",
            select:
              "_id objectName description userId companyId month year day createdAt",
            populate: {
              path: "companyId userId",
              select: "name surname linkPath",
            },
          })
          .populate({
            path: "communitingId",
            select:
              "_id city description userId companyId month year day timeStart timeEnd",
            populate: {
              path: "companyId userId",
              select: "name surname linkPath",
            },
          })
          .then((userAlerts) => {
            return Alert.countDocuments({
              toUserId: user._id,
              active: true,
            }).then((activeUserAllerts) => {
              const userName = Buffer.from(user.name, "base64").toString(
                "utf-8"
              );
              const userSurname = Buffer.from(user.surname, "base64").toString(
                "utf-8"
              );
              let validUserActiveCount = 0;
              if (!!activeUserAllerts) {
                if (activeUserAllerts > 0) {
                  validUserActiveCount = activeUserAllerts;
                }
              }
              const isNotCompanyStamps = user.stamps.some((stamp) => {
                const isInReserwationsStampsCanceled = stamp.reserwations.some(
                  (itemStamp) => itemStamp.visitCanceled
                );
                return (
                  stamp.companyId === null || isInReserwationsStampsCanceled
                );
              });
              const isNotCompanyFavourites = user.favouritesCompanys.some(
                (fav) => fav === null
              );
              if (isNotCompanyStamps || isNotCompanyFavourites) {
                if (isNotCompanyStamps) {
                  const newUserStamps = [];
                  user.stamps.forEach((stamp) => {
                    if (stamp.companyId !== null) {
                      const filterCompanyNoActiveStamps =
                        stamp.reserwations.filter(
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
                findCompanyInAllCompanys = user.allCompanys.find(
                  (itemCompany) => {
                    return (
                      itemCompany._id.toString() == user.company.toString()
                    );
                  }
                );
              }

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
                alerts: !!userAlerts ? userAlerts : [],
                alertActiveCount: validUserActiveCount,
                imageUrl: !!user.imageOther ? user.imageOther : user.imageUrl,
                hasPhone: user.hasPhone,
                stamps: user.stamps,
                favouritesCompanys: user.favouritesCompanys,
                phoneVerified: user.phoneVerified,
                blockUserChangePhoneNumber: user.blockUserChangePhoneNumber,
                emailVerified: user.emailVerified,
                emailToVerified: user.emailToVerified,
                blockUserChangeEmail: user.blockUserChangeEmail,
                blockUserSendVerifiedPhoneSms:
                  user.blockUserSendVerifiedPhoneSms,
                vapidPublic: PUBLIC_KEY_VAPID,
                language: !!user.language ? user.language : "pl",
                darkMode: !!user.darkMode ? user.darkMode : false,
                blindMode: !!user.blindMode ? user.blindMode : false,
              });
            });
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
  const newEmail = req.body.newEmail ? req.body.newEmail : null;
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
      "_id language phoneVerified blockUserSendVerifiedPhoneSms emailVerified emailToVerified blockUserChangeEmail blockUserChangePhoneNumber password email loginToken phone accountVerified company codeVerifiedPhoneDate codeVerifiedPhone whiteListVerifiedPhones"
    )
    .then((user) => {
      if (!!user) {
        return bcrypt
          .compare(password, user.password)
          .then((doMatch) => {
            if (!!doMatch) {
              if (!!newPhone || !!newPassword || newEmail) {
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
                if (!!newEmail) {
                  return User.countDocuments({
                    email: newEmail,
                  }).then((countUsersPhone) => {
                    if (!!!countUsersPhone) {
                      const randomCodeEmail = makeid(6);
                      const hashedCodeToVerifiedEmail = Buffer.from(
                        randomCodeEmail,
                        "utf-8"
                      ).toString("base64");
                      user.emailVerified = false;
                      user.emailToVerified = newEmail;
                      user.blockUserChangeEmail = new Date(
                        new Date().setHours(new Date().getHours() + 1)
                      );
                      user.codeToVerifiedEmail = hashedCodeToVerifiedEmail;
                      return user.save();
                    } else {
                      const error = new Error("Adres email jest zajęty");
                      error.statusCode = 443;
                      throw error;
                    }
                  });
                }
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
          .then(async (userSavedData) => {
            if (!!!userSavedData.phoneVerified && !!newPhone) {
              const codeToDelete = Buffer.from(
                userSavedData.codeVerifiedPhone,
                "base64"
              ).toString("utf-8");

              const propsGenerator = generateEmail.generateContentEmail({
                alertType: "alert_confirm_account_phone",
                companyChanged: false,
                language: !!userSavedData.language
                  ? userSavedData.language
                  : "PL",
                itemAlert: null,
                collection: "Default",
              });

              await notifications.sendVerifySMS({
                phoneNumber: newPhone,
                message: `${
                  propsGenerator.title
                } ${codeToDelete.toUpperCase()}`,
              });
            } else if (!!newEmail && !!!userSavedData.emailVerified) {
              const codeToActiveEmail = Buffer.from(
                userSavedData.codeToVerifiedEmail,
                "base64"
              ).toString("utf-8");

              const propsGenerator = generateEmail.generateContentEmail({
                alertType: "alert_confirm_account_email",
                companyChanged: false,
                language: !!userSavedData.language
                  ? userSavedData.language
                  : "PL",
                itemAlert: null,
                collection: "Default",
              });

              notifications.sendEmail({
                email: userSavedData.emailToVerified,
                title: propsGenerator.title,
                defaultText: `${propsGenerator.title} ${codeToActiveEmail}`,
              });
            }
            return userSavedData;
          })
          .then((result) => {
            const userPhone = !!result.phone
              ? Buffer.from(result.phone, "base64").toString("utf-8")
              : null;

            if (!!newPassword) {
              const propsGenerator = generateEmail.generateContentEmail({
                alertType: "alert_confirm_account_edit",
                companyChanged: false,
                language: !!result.language ? result.language : "PL",
                itemAlert: null,
                collection: "Default",
              });

              notifications.sendEmail({
                email: result.email,
                ...propsGenerator,
              });
            }

            res.status(201).json({
              emailVerified: result.emailVerified,
              emailToVerified: result.emailToVerified,
              blockUserChangeEmail: result.blockUserChangeEmail,
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
              const error = new Error(err);
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

      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_reset_account",
        companyChanged: false,
        language: !!result.language ? result.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      const propsGeneratorDate = generateEmail.generateContentEmail({
        alertType: "alert_reset_account_date",
        companyChanged: false,
        language: !!result.language ? result.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: result.email,
        title: propsGenerator.title,
        defaultText: `${propsGenerator.title}: ${codeToResetPassword}.
        ${propsGeneratorDate.title}: ${showDate}`,
      });

      res.status(200).json({
        message: "Email send",
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
      "email codeToResetPassword _id loginToken password dateToResetPassword language"
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
      const propsGeneratorDate = generateEmail.generateContentEmail({
        alertType: "alert_reset_account_success",
        companyChanged: false,
        language: !!result.language ? result.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: result.email,
        ...propsGeneratorDate,
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
    email: email.toLowerCase(),
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
                  email: email.toLowerCase(),
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
                  language: "pl",
                  darkMode: false,
                  blindMode: false,
                  emailVerified: true,
                  emailToVerified: null,
                  blockUserChangeEmail: new Date(),
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
                    const propsGeneratorDate =
                      generateEmail.generateContentEmail({
                        alertType: "alert_created_account_fb",
                        companyChanged: false,
                        language: !!result.language ? result.language : "PL",
                        itemAlert: null,
                        collection: "Default",
                      });

                    const propsGeneratorDateSocial =
                      generateEmail.generateContentEmail({
                        alertType: "alert_created_account_social",
                        companyChanged: false,
                        language: !!result.language ? result.language : "PL",
                        itemAlert: null,
                        collection: "Default",
                      });

                    notifications.sendEmail({
                      email: userSaved.email,
                      title: propsGeneratorDateSocial.title,
                      defaultText: `${propsGeneratorDate.title} ${randomPassword}`,
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
    email: email.toLowerCase(),
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
                  email: email.toLowerCase(),
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
                  language: "pl",
                  darkMode: false,
                  blindMode: false,
                  emailVerified: true,
                  emailToVerified: null,
                  blockUserChangeEmail: new Date(),
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
                    const propsGeneratorDate =
                      generateEmail.generateContentEmail({
                        alertType: "alert_created_account_google",
                        companyChanged: false,
                        language: !!result.language ? result.language : "PL",
                        itemAlert: null,
                        collection: "Default",
                      });

                    const propsGeneratorDateSocial =
                      generateEmail.generateContentEmail({
                        alertType: "alert_created_account_social",
                        companyChanged: false,
                        language: !!result.language ? result.language : "PL",
                        itemAlert: null,
                        collection: "Default",
                      });

                    notifications.sendEmail({
                      email: userSaved.email,
                      title: propsGeneratorDateSocial.title,
                      defaultText: `${propsGeneratorDate.title} ${randomPassword}`,
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
    .select("_id codeDeleteDate codeDelete email allCompanys language")
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
      const codeToDelete = Buffer.from(
        userSavedData.codeDelete,
        "base64"
      ).toString("utf-8");

      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_delete_account",
        companyChanged: false,
        language: !!userSavedData.language ? userSavedData.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: userSavedData.email,
        title: propsGenerator.title,
        defaultText: `${propsGenerator.title}: ${codeToDelete.toUpperCase()}`,
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
    blockUserSendVerifiedPhoneSms: {
      $lte: new Date(),
    },
  })
    .select(
      "_id blockUserSendVerifiedPhoneSms codeVerifiedPhoneDate codeVerifiedPhone email phone language"
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
      const codeToDelete = Buffer.from(
        userSavedData.codeVerifiedPhone,
        "base64"
      ).toString("utf-8");

      const phoneNumber = Buffer.from(userSavedData.phone, "base64").toString(
        "utf-8"
      );

      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_confirm_account_phone",
        companyChanged: false,
        language: !!userSavedData.language ? userSavedData.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendVerifySMS({
        phoneNumber: phoneNumber,
        message: `${propsGenerator.title} ${codeToDelete.toUpperCase()}`,
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
    .then(async () => {
      await notifications.updateAllCollection({
        companyField: "company",
        collection: "Reserwation",
        collectionItems:
          "_id serviceName fromUser toWorkerUserId company isDeleted oldReserwationId hasCommuniting dateYear dateMonth dateDay dateStart dateEnd fullDate costReserwation extraCost extraTime timeReserwation workerReserwation visitNotFinished visitCanceled visitChanged reserwationMessage serviceId activePromotion activeHappyHour activeStamp basicPrice opinionId isDraft sendSMSReserwation sendSMSReserwationUserChanged sendSMSNotifaction sendSMSCanceled sendSMSChanged communitingId",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: { visitCanceled: true },
        filtersCollection: {
          fromUser: mongoose.Types.ObjectId(userId),
          isDraft: { $in: [false, null] },
          visitNotFinished: false,
          visitCanceled: false,
          fullDate: {
            $gte: new Date().toISOString(),
          },
          isDeleted: { $in: [false, null] },
          workerReserwation: false,
          hasCommuniting: { $in: [false, null] },
        },

        userField: "fromUser",
        workerField: "toWorkerUserId",
        sendEmailValid: true,
        notificationContent: {
          typeAlert: "reserwationId",
          avaibleSendAlertToWorker: true,
        },
        smsContent: {
          companySendSMSValidField: "smsCanceledAvaible",
          titleCompanySMSAlert: "sms_canceled_reserwation",
          collectionFieldSMSOnSuccess: {
            sendSMSCanceled: true,
          },
        },
        companyChanged: false,
        typeNotification: "reserwation_canceled",
        deleteOpinion: false,
      });
      return true;
    })
    .then(async () => {
      await notifications.updateAllCollection({
        companyField: "companyId",
        collection: "Service",
        collectionItems:
          "_id objectName description userId companyId month year day createdAt workerUserId statusValue dateStart dateService dateEnd opinionId cost",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: { isDeleted: true },
        filtersCollection: {
          userId: userId,
          isDeleted: { $in: [false, null] },
          statusValue: { $in: [1, 2] },
        },
        userField: "userId",
        workerField: "workerUserId",
        sendEmailValid: true,
        notificationContent: {
          typeAlert: "serviceId",
          avaibleSendAlertToWorker: true,
        },
        smsContent: {
          companySendSMSValidField: "smsServiceCanceledAvaible",
          titleCompanySMSAlert: "sms_canceled_service",
          collectionFieldSMSOnSuccess: {
            canceledSMS: true,
          },
        },
        companyChanged: false,
        typeNotification: "service_deleted",
        deleteOpinion: false,
      });
      return true;
    })
    .then(async () => {
      await notifications.updateAllCollection({
        companyField: "companyId",
        collection: "Communiting",
        collectionItems:
          "_id city description userId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: { isDeleted: true },
        filtersCollection: {
          userId: userId,
          isDeleted: { $in: [false, null] },
          statusValue: { $in: [1, 2] },
          fullDate: {
            $gte: new Date().toISOString(),
          },
        },
        userField: "userId",
        workerField: "workerUserId",
        sendEmailValid: true,
        notificationContent: {
          typeAlert: "communitingId",
          avaibleSendAlertToWorker: true,
        },
        smsContent: {
          companySendSMSValidField: "smsCommunitingCanceledAvaible",
          titleCompanySMSAlert: "sms_canceled_communiting",
          collectionFieldSMSOnSuccess: {
            canceledSMS: true,
          },
        },
        companyChanged: false,
        typeNotification: "commuting_canceled",
        deleteOpinion: false,
      });

      return true;
    })
    .then(() => {
      return CompanyUsersInformations.deleteMany({ userId: userId });
    })
    .then(() => {
      return User.findOneAndDelete({ _id: userId })
        .select("_id email language")
        .then((userDoc) => {
          if (!!userDoc) {
            const propsGenerator = generateEmail.generateContentEmail({
              alertType: "alert_deleted_account_success",
              companyChanged: false,
              language: !!userDoc.language ? userDoc.language : "PL",
              itemAlert: null,
              collection: "Default",
            });

            notifications.sendEmail({
              email: userDoc.email,
              ...propsGenerator,
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
      "_id codeVerifiedPhoneDate codeVerifiedPhone name surname email phoneVerified phone whiteListVerifiedPhones language"
    )
    .then((userData) => {
      if (!!userData) {
        if (!!userData.codeVerifiedPhone) {
          const unhashedPhone = Buffer.from(userData.phone, "base64").toString(
            "utf-8"
          );

          return User.countDocuments({
            phone: unhashedPhone,
          }).then((countUsersWithThisPhone) => {
            if (!!!countUsersWithThisPhone) {
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
            } else {
              const error = new Error("Numer telefonu jest zajęty.");
              error.statusCode = 423;
              throw error;
            }
          });
        } else {
          const error = new Error("Numer już aktywowany.");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 403;
        throw error;
      }
    })
    .then((userData) => {
      const token = jwt.sign(
        {
          email: userData.email,
          userId: userData._id.toString(),
        },
        TOKEN_PASSWORD,
        {
          expiresIn: BCRIPT_EXPIRES_IN,
        }
      );
      userData.loginToken = token;
      userData.codeVerifiedPhoneDate = null;
      userData.codeVerifiedPhone = null;
      userData.phoneVerified = true;
      userData.whiteListVerifiedPhones.push(userData.phone);
      return userData.save();
    })
    .then((userDoc) => {
      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_veryfied_phone_account",
        companyChanged: false,
        language: !!userDoc.language ? userDoc.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: userDoc.email,
        ...propsGenerator,
      });
      return userDoc;
    })
    .then((userDoc) => {
      res.status(201).json({
        token: userDoc.loginToken,
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

exports.userCancelCommuniting = async (req, res, next) => {
  const userId = req.userId;
  const communityId = req.body.communityId;
  const reserwationId = req.body.reserwationId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  if (!!reserwationId) {
    Reserwation.deleteOne({ _id: reserwationId })
      .then(async () => {
        await notifications.updateAllCollection({
          companyField: "companyId",
          collection: "Communiting",
          collectionItems:
            "_id city description userId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: { statusValue: 4, reserwationId: null },
          filtersCollection: {
            _id: communityId,
            userId: userId,
          },
          userField: "userId",
          workerField: "workerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "communitingId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: {
            companySendSMSValidField: "smsCommunitingCanceledAvaible",
            titleCompanySMSAlert: "sms_canceled_communiting",
            collectionFieldSMSOnSuccess: {
              canceledSMS: true,
            },
          },
          companyChanged: false,
          typeNotification: "commuting_canceled",
          deleteOpinion: false,
        });
      })
      .catch((err) => {
        if (!err.statusCode) {
          err.statusCode = 501;
          err.message = "Brak danego konta firmowego";
        }
        next(err);
      });
  } else {
    await notifications.updateAllCollection({
      companyField: "companyId",
      collection: "Communiting",
      collectionItems:
        "_id city description userId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd",
      extraCollectionPhoneField: "phone",
      extraCollectionEmailField: "email",
      extraCollectionNameField: "name surname",
      updateCollectionItemObject: { statusValue: 4, reserwationId: null },
      filtersCollection: {
        _id: communityId,
        userId: userId,
      },
      userField: "userId",
      workerField: "workerUserId",
      sendEmailValid: true,
      notificationContent: {
        typeAlert: "communitingId",
        avaibleSendAlertToWorker: true,
      },
      smsContent: {
        companySendSMSValidField: "smsCommunitingCanceledAvaible",
        titleCompanySMSAlert: "sms_canceled_communiting",
        collectionFieldSMSOnSuccess: {
          canceledSMS: true,
        },
      },
      companyChanged: false,
      typeNotification: "commuting_canceled",
      deleteOpinion: false,
    });
  }
  res.status(200).json({
    message: "Odwołano dojazd",
  });
};

exports.downloadCommuniting = (req, res, next) => {
  const communitingId = req.body.communitingId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Communiting.findOne({
    _id: communitingId,
  })
    .select(
      "_id city description cost companyId month year day timeStart timeEnd street statusValue isDeleted"
    )
    .populate("companyId", "name linkPath")
    .then((communitingData) => {
      if (!!communitingData) {
        res.status(200).json({
          communiting: communitingData,
        });
      } else {
        const error = new Error("Brak dojazdu");
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

exports.downloadService = (req, res, next) => {
  const serviceId = req.body.serviceId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Service.findOne({
    _id: serviceId,
  })
    .select(
      "_id objectName description cost companyId month year day statusValue isDeleted"
    )
    .populate("companyId", "name linkPath")
    .then((serviceData) => {
      if (!!serviceData) {
        res.status(200).json({
          service: serviceData,
        });
      } else {
        const error = new Error("Brak dojazdu");
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

exports.userUpdateProps = (req, res, next) => {
  const userId = req.userId;
  const language = req.body.language;
  const darkMode = req.body.darkMode;
  const blindMode = req.body.blindMode;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
  })
    .select("_id language darkMode blindMode")
    .then((user) => {
      if (!!user) {
        user.language = language;
        user.darkMode = darkMode;
        user.blindMode = blindMode;
        return user.save();
      } else {
        res.status(422).json({
          message: "Brak użytkownika",
        });
      }
    })
    .then(() => {
      res.status(200).json({
        message: "Zaktualizowano ustawienia użytkownika",
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

exports.verifiedUserEmail = (req, res, next) => {
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
      "_id emailVerified emailToVerified codeToVerifiedEmail blockUserChangeEmail email language"
    )
    .then((userData) => {
      if (!!userData) {
        if (!!userData.codeToVerifiedEmail) {
          return User.countDocuments({
            email: userData.emailToVerified,
          }).then((countUsersWithThisEmail) => {
            if (!!!countUsersWithThisEmail) {
              const codeToVerified = Buffer.from(
                userData.codeToVerifiedEmail,
                "base64"
              ).toString("utf-8");
              if (
                code.toUpperCase() === codeToVerified.toUpperCase() &&
                userData.blockUserChangeEmail > new Date()
              ) {
                return userData;
              } else {
                const error = new Error("Błędny kod.");
                error.statusCode = 422;
                throw error;
              }
            } else {
              const error = new Error("Adres email jest zajęty.");
              error.statusCode = 423;
              throw error;
            }
          });
        } else {
          const error = new Error("Adres email już aktywowany.");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 403;
        throw error;
      }
    })
    .then((userData) => {
      const token = jwt.sign(
        {
          email: userData.emailToVerified,
          userId: userData._id.toString(),
        },
        TOKEN_PASSWORD,
        {
          expiresIn: BCRIPT_EXPIRES_IN,
        }
      );
      userData.loginToken = token;
      userData.codeToVerifiedEmail = null;
      userData.email = userData.emailToVerified;
      userData.emailToVerified = null;
      userData.emailVerified = true;
      return userData.save();
    })
    .then((userDoc) => {
      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_veryfied_email_user_account_success",
        companyChanged: false,
        language: !!userDoc.language ? userDoc.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: userDoc.email,
        ...propsGenerator,
      });
      return userDoc;
    })
    .then((userDoc) => {
      res.status(201).json({
        token: userDoc.loginToken,
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

exports.userSentCodeVerifiedEmail = (req, res, next) => {
  const userId = req.userId;

  User.findOne({
    _id: userId,
    blockUserChangeEmail: {
      $lte: new Date(),
    },
  })
    .select(
      "_id emailVerified emailToVerified codeToVerifiedEmail blockUserChangeEmail email language"
    )
    .then((resultUserDoc) => {
      if (!!resultUserDoc) {
        const validBlockUserSendVerifiedEmail =
          !!resultUserDoc.blockUserChangeEmail
            ? resultUserDoc.blockUserChangeEmail
            : null;
        if (validBlockUserSendVerifiedEmail <= new Date()) {
          const randomCode = makeid(6);
          const hashedCodeToVerified = Buffer.from(
            randomCode,
            "utf-8"
          ).toString("base64");
          resultUserDoc.codeToVerifiedEmail = hashedCodeToVerified;
          resultUserDoc.blockUserChangeEmail = new Date(
            new Date().setHours(new Date().getHours() + 1)
          );
          return resultUserDoc.save();
        } else {
          const error = new Error(
            "Nie można wysłać ponownie wiadomość do aktywcji adresu email"
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
      const codeToVerified = Buffer.from(
        userSavedData.codeToVerifiedEmail,
        "base64"
      ).toString("utf-8");

      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_confirm_account_email",
        companyChanged: false,
        language: !!userSavedData.language ? userSavedData.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: userSavedData.emailToVerified,
        title: propsGenerator.title,
        defaultText: `${propsGenerator.title} ${codeToVerified}`,
      });

      res.status(201).json({
        blockUserChangeEmail: userSavedData.blockUserChangeEmail,
      });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Błąd podczas wysyłania kodu do potwierdzenia adresu email.";
      }
      next(err);
    });
};

exports.userDeleteVerifiedPhone = (req, res, next) => {
  const userId = req.userId;

  User.findOne({
    _id: userId,
    accountVerified: true,
  })
    .select(
      "_id phone whiteListVerifiedPhones phoneVerified email language codeVerifiedPhone"
    )
    .then((resultUserDoc) => {
      if (!!resultUserDoc) {
        if (!!resultUserDoc.whiteListVerifiedPhones) {
          if (resultUserDoc.whiteListVerifiedPhones.length > 0) {
            const selectedPhoneNumber =
              resultUserDoc.whiteListVerifiedPhones[
                resultUserDoc.whiteListVerifiedPhones.length - 1
              ];
            resultUserDoc.phone = selectedPhoneNumber;
            resultUserDoc.phoneVerified = true;
            resultUserDoc.codeVerifiedPhone = null;

            return resultUserDoc.save();
          } else {
            const error = new Error("Nie można zmienić numeru.");
            error.statusCode = 420;
            throw error;
          }
        } else {
          const error = new Error("Nie można zmienić numeru.");
          error.statusCode = 420;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((userSavedData) => {
      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_delete_verified_phone",
        companyChanged: false,
        language: !!userSavedData.language ? userSavedData.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: userSavedData.email,
        ...propsGenerator,
      });

      const userPhone = Buffer.from(userSavedData.phone, "base64").toString(
        "utf-8"
      );

      res.status(201).json({
        userPhone: userPhone,
      });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Błąd podczas wysyłania kodu do potwierdzenia adresu email.";
      }
      next(err);
    });
};

exports.userDeleteVerifiedEmail = (req, res, next) => {
  const userId = req.userId;

  User.findOne({
    _id: userId,
    accountVerified: true,
  })
    .select(
      "_id emailVerified emailToVerified codeToVerifiedEmail email language"
    )
    .then((resultUserDoc) => {
      if (!!resultUserDoc) {
        if (!!resultUserDoc.email) {
          resultUserDoc.emailVerified = true;
          resultUserDoc.emailToVerified = null;
          resultUserDoc.codeToVerifiedEmail = null;

          return resultUserDoc.save();
        } else {
          const error = new Error("Nie można anulować zmiany.");
          error.statusCode = 420;
          throw error;
        }
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((userSavedData) => {
      const propsGenerator = generateEmail.generateContentEmail({
        alertType: "alert_delete_verified_email",
        companyChanged: false,
        language: !!userSavedData.language ? userSavedData.language : "PL",
        itemAlert: null,
        collection: "Default",
      });

      notifications.sendEmail({
        email: userSavedData.email,
        ...propsGenerator,
      });

      res.status(201).json({
        userEmail: userSavedData.email,
      });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Błąd podczas wysyłania kodu do potwierdzenia adresu email.";
      }
      next(err);
    });
};
