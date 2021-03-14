const User = require("../models/user");
const Company = require("../models/company");
const Reserwation = require("../models/reserwation");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const io = require("../socket");
const getImgBuffer = require("../getImgBuffer");
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

  User.findOne({ email: email })
    .select("email _id")
    .then((userDoc) => {
      if (!!!userDoc) {
        return bcrypt
          .hash(password, Number(BCRIPT_EXPIRES_IN))
          .then((hashedPassword) => {
            if (hashedPassword) {
              const codeToVerified = makeid(6);

              const hashedCodeToVerified = Buffer.from(
                codeToVerified.toUpperCase(),
                "utf-8"
              ).toString("base64");

              const hashedUserName = Buffer.from(userName, "utf-8").toString(
                "base64"
              );

              const hashedUserSurname = Buffer.from(
                userSurname,
                "utf-8"
              ).toString("base64");

              const hashedPhoneNumber = Buffer.from(
                phoneNumber,
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
                hasCompany: false,
                phoneVerified: false,
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
        const error = new Error("Użytkownik zajęty.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then((result) => {
      const userName = Buffer.from(result.name, "base64").toString("ascii");
      const userSurname = Buffer.from(result.surname, "base64").toString(
        "ascii"
      );
      const unhashedCodeToVerified = Buffer.from(
        result.codeToVerified,
        "base64"
      ).toString("ascii");
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
      "email blockUserSendVerifiedPhoneSms blockUserChangePhoneNumber _id phoneVerified imageUrl hasPhone name surname alerts favouritesCompanys company stamps loginToken password codeToResetPassword token accountVerified hasCompany alertActiveCount imageOther"
    )
    .slice("alerts", 10)
    .populate("favouritesCompanys", "_id linkPath name")
    .populate(
      "company",
      "accountVerified allDataVerified owner pauseCompany name workers._id workers.user workers.permissions"
    )
    .populate(
      "stamps.companyId",
      "_id linkPath companyStamps services.serviceName services._id name"
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
              "ascii"
            );
            const userSurname = Buffer.from(
              userWithToken.surname,
              "base64"
            ).toString("ascii");

            const isNotCompanyStamps = userWithToken.stamps.some(
              (stamp) => stamp.companyId === null
            );
            const isNotCompanyFavourites = userWithToken.favouritesCompanys.some(
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
                const filterFavUser = userWithToken.favouritesCompanys.filter(
                  (fav) => fav !== null
                );
                userWithToken.favouritesCompanys = filterFavUser;
              }
              userWithToken.save();
            }

            res.status(201).json({
              userId: userWithToken._id.toString(),
              email: userWithToken.email,
              userName: userName,
              userSurname: userSurname,
              token: userWithToken.loginToken,
              accountVerified: userWithToken.accountVerified,
              hasCompany: userWithToken.hasCompany,
              company: userWithToken.company,
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
        ).toString("ascii");
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
          const userPhone = Buffer.from(user.phone, "base64").toString("ascii");
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
            .select("phone _id")
            .then((user) => {
              if (!!user) {
                const userPhone = Buffer.from(user.phone, "base64").toString(
                  "ascii"
                );
                res.status(201).json({
                  userPhone: userPhone,
                });
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
    .select("_id accountVerified codeToVerified hasCompany company email")
    .then((user) => {
      if (!!user) {
        const unhashedCodeToVerified = Buffer.from(
          user.codeToVerified,
          "base64"
        ).toString("ascii");
        if (unhashedCodeToVerified.toUpperCase() === codeSent.toUpperCase()) {
          user.codeToVerified = null;
          user.accountVerified = true;
          user.hasCompany = false;
          user.company = null;
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
        user.alerts.forEach((alert, index) => {
          user.alerts[index].active = false;
        });
        user.alertActiveCount = 0;
        return user.save();
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
    .populate(
      "company",
      "accountVerified allDataVerified owner pauseCompany name workers._id workers.user workers.permissions"
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
      "_id loginToken blockUserSendVerifiedPhoneSms blockUserChangePhoneNumber phoneVerified favouritesCompanys stamps company alerts name surname alertActiveCount email accountVerified hasCompany imageUrl hasPhone imageOther"
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
      "company",
      "accountVerified allDataVerified owner pauseCompany name workers._id workers.user workers.permissions"
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
    .then((user) => {
      if (!!user) {
        const userName = Buffer.from(user.name, "base64").toString("ascii");
        const userSurname = Buffer.from(user.surname, "base64").toString(
          "ascii"
        );
        let validUserActiveCount = 0;
        if (!!user.alertActiveCount) {
          if (user.alertActiveCount > 0) {
            validUserActiveCount = user.alertActiveCount;
          }
        }

        const isNotCompanyStamps = user.stamps.some(
          (stamp) => stamp.companyId === null
        );
        const isNotCompanyFavourites = user.favouritesCompanys.some(
          (fav) => fav === null
        );
        if (isNotCompanyStamps || isNotCompanyFavourites) {
          if (isNotCompanyStamps) {
            const filterStampsUser = user.stamps.filter(
              (stamp) => stamp.companyId !== null
            );
            user.stamps = filterStampsUser;
          }
          if (isNotCompanyFavourites) {
            const filterFavUser = user.favouritesCompanys.filter(
              (fav) => fav !== null
            );
            user.favouritesCompanys = filterFavUser;
          }
          user.save();
        }

        res.status(200).json({
          userId: user._id.toString(),
          email: user.email,
          token: user.loginToken,
          accountVerified: user.accountVerified,
          userName: userName,
          userSurname: userSurname,
          hasCompany: user.hasCompany,
          company: user.company,
          alerts: user.alerts,
          alertActiveCount: validUserActiveCount,
          imageUrl: !!user.imageOther ? user.imageOther : user.imageUrl,
          hasPhone: user.hasPhone,
          stamps: user.stamps,
          favouritesCompanys: user.favouritesCompanys,
          phoneVerified: user.phoneVerified,
          blockUserChangePhoneNumber: user.blockUserChangePhoneNumber,
          blockUserSendVerifiedPhoneSms: user.blockUserSendVerifiedPhoneSms,
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
      "_id phoneVerified blockUserSendVerifiedPhoneSms blockUserChangePhoneNumber password email loginToken phone name surname accountVerified hasCompany company codeVerifiedPhoneDate codeVerifiedPhone whiteListVerifiedPhones"
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
                  const validBlockUserChangePhoneNumber = !!user.blockUserChangePhoneNumber
                    ? user.blockUserChangePhoneNumber
                    : null;
                  if (validBlockUserChangePhoneNumber <= new Date()) {
                    const hashedPhoneNumber = Buffer.from(
                      newPhone,
                      "utf-8"
                    ).toString("base64");

                    const isPhoneInWhiteList = user.whiteListVerifiedPhones.some(
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
                        return user;
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
                return user.save();
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
              ).toString("ascii");
              const userSurname = Buffer.from(
                userSavedData.surname,
                "base64"
              ).toString("ascii");
              const codeToDelete = Buffer.from(
                userSavedData.codeVerifiedPhone,
                "base64"
              ).toString("ascii");

              // const params = {
              //   Message: `Kod potwierdzający numer telefonu: ${codeToDelete.toUpperCase()}`,
              //   MessageStructure: "string",
              //   PhoneNumber: "+48515873009",
              //   MessageAttributes: {
              //     "AWS.SNS.SMS.SenderID": {
              //       DataType: "String",
              //       StringValue: "Nootis",
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
              ? Buffer.from(result.phone, "base64").toString("ascii")
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
      ).toString("ascii");
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
        subject: "Kod z kodem resetującym hasło an nootise",
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

exports.addCompanyId = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({
    _id: userId,
    company: null,
    hasCompany: false,
  })
    .select("_id company hasCompany email")
    .then((user) => {
      if (!!user) {
        user.company = companyId;
        user.hasCompany = true;
        return user.save();
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 502;
        throw error;
      }
    })
    .then((result) => {
      transporter.sendMail({
        to: result.email,
        from: MAIL_INFO,
        subject: "Tworzenie konta zakończone powodzeniem",
        html: `<h1>Dodano do firmy!</h1>`,
      });
      res.status(201).json({
        message: "Dodano firmę użytkownikowi",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas dodawania firmy.";
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
    _json: { email, name, picture },
  } = req.user.profile;
  User.findOne({
    email: email,
  })
    .select("email _id loginToken")
    .then((userDoc) => {
      if (!!userDoc) {
        res.redirect(
          303,
          `${SITE_FRONT}/login-facebook?${userDoc.loginToken}&${userDoc._id}&false`
        );
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
                  imageOther: !!picture ? picture.data.url : "",
                  hasCompany: false,
                  company: null,
                  phoneVerified: false,
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
  User.findOne({
    _id: userId,
  })
    .select("_id favouritesCompanys")
    .then((userDoc) => {
      if (!!userDoc) {
        const isInFavourites = userDoc.favouritesCompanys.some(
          (item) => item == companyId
        );
        if (!isInFavourites) {
          userDoc.favouritesCompanys.push(companyId);
        }
        return userDoc.save();
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
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
  User.findOne({
    _id: userId,
  })
    .select("_id favouritesCompanys")
    .then((userDoc) => {
      if (!!userDoc) {
        const filterUserFavourites = userDoc.favouritesCompanys.filter(
          (item) => item != companyId
        );
        userDoc.favouritesCompanys = filterUserFavourites;
        return userDoc.save();
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
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

exports.loginFacebookCustom = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  User.findOne({
    _id: userId,
  })
    .select("_id favouritesCompanys")
    .then((userDoc) => {
      if (!!userDoc) {
        const filterUserFavourites = userDoc.favouritesCompanys.filter(
          (item) => item != companyId
        );
        userDoc.favouritesCompanys = filterUserFavourites;
        return userDoc.save();
      } else {
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
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
    _json: { email, name, picture },
  } = req.user.profile;
  User.findOne({
    email: email,
  })
    .select("email _id loginToken")
    .then((userDoc) => {
      if (!!userDoc) {
        res.redirect(
          303,
          `${SITE_FRONT}/login-google?${userDoc.loginToken}&${userDoc._id}&false`
        );
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
                  imageOther: !!picture ? picture : "",
                  hasCompany: false,
                  company: null,
                  phoneVerified: false,
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
    company: null,
    hasCompany: false,
  })
    .select("_id codeDeleteDate codeDelete name surname email")
    .then((resultUserDoc) => {
      if (!!resultUserDoc) {
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
        const error = new Error("Brak użytkownika.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((userSavedData) => {
      const userName = Buffer.from(userSavedData.name, "base64").toString(
        "ascii"
      );
      const userSurname = Buffer.from(userSavedData.surname, "base64").toString(
        "ascii"
      );
      const codeToDelete = Buffer.from(
        userSavedData.codeDelete,
        "base64"
      ).toString("ascii");
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
        const validBlockUserSendVerifiedPhoneSms = !!resultUserDoc.blockUserSendVerifiedPhoneSms
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
        "ascii"
      );
      const userSurname = Buffer.from(userSavedData.surname, "base64").toString(
        "ascii"
      );
      const codeToDelete = Buffer.from(
        userSavedData.codeVerifiedPhone,
        "base64"
      ).toString("ascii");

      // const params = {
      //   Message: `Kod potwierdzenia telefonu: ${codeToDelete.toUpperCase()}`,
      //   MessageStructure: "string",
      //   PhoneNumber: "+48515873009",
      //   MessageAttributes: {
      //     "AWS.SNS.SMS.SenderID": {
      //       DataType: "String",
      //       StringValue: "Nootis",
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
  User.findOne({ _id: userId, company: null, hasCompany: false })
    .select("_id codeDeleteDate codeDelete name surname email")
    .then((userData) => {
      const codeToDelete = Buffer.from(userData.codeDelete, "base64").toString(
        "ascii"
      );
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
    })
    .then(() => {
      const actualDay = new Date();
      return Reserwation.find({
        fromUser: userId,
        visitNotFinished: false,
        visitCanceled: false,
      })
        .select(
          "toWorkerUserId company dateYear dateMonth dateDay dateEnd dateStart visitNotFinished visitCanceled fromUser serviceName"
        )
        .populate({
          path: "company fromUser",
          select: "name surname linkPath",
        })
        .then((allWorkerReserwations) => {
          const allUsersReserwations = [];
          if (!!allWorkerReserwations) {
            allWorkerReserwations.forEach((item) => {
              const splitDateStart = item.dateStart.split(":");
              const reserwationDate = new Date(
                item.dateYear,
                item.dateMonth - 1,
                item.dateDay,
                Number(splitDateStart[0]),
                Number(splitDateStart[1])
              );
              if (reserwationDate > actualDay) {
                item.visitCanceled = true;
                item.save();
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
              }
            });
            return allUsersReserwations;
          }
        });
    })
    .then((result) => {
      result.forEach((userDoc) => {
        User.findOne({
          _id: userDoc.userId,
        })
          .select("_id alerts alertActiveCount")
          .then((userReserwationDoc) => {
            if (!!userReserwationDoc) {
              const allUserAlertsToSave = [];

              userDoc.items.forEach((itemReserwation) => {
                const userAlertToSave = {
                  reserwationId: itemReserwation._id,
                  active: true,
                  type: "rezerwation_canceled",
                  creationTime: new Date(),
                  companyChanged: false,
                };

                io.getIO().emit(`user${userReserwationDoc._id}`, {
                  action: "update-alerts",
                  alertData: {
                    reserwationId: itemReserwation,
                    active: true,
                    type: "rezerwation_canceled",
                    creationTime: new Date(),
                    companyChanged: false,
                  },
                });

                allUserAlertsToSave.push(userAlertToSave);
              });
              userReserwationDoc.alerts.unshift(...allUserAlertsToSave);

              const countAlertsActiveValid = !!userReserwationDoc.alertActiveCount
                ? userReserwationDoc.alertActiveCount
                : 0;
              userReserwationDoc.alertActiveCount =
                countAlertsActiveValid + allUserAlertsToSave.length;

              userReserwationDoc.save();
            }
          });
        return true;
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
      ).toString("ascii");
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
