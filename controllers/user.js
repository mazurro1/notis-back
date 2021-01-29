const User = require("../models/user");
const Company = require("../models/company");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const io = require("../socket");
const nodemailer = require("nodemailer");

const sendgridTransport = require("nodemailer-sendgrid-transport");
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        "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",
    },
  })
);

exports.registration = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const phoneNumber = req.body.phoneNumber;
  const userName = req.body.userName;
  const userSurname = req.body.userSurname;
  const dateBirth = req.body.dateBirth;
  const monthBirth = req.body.monthBirth;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  User.findOne({ email: email })
    .select("-phone -password")
    .then((userDoc) => {
      if (!userDoc) {
        return bcrypt.hash(password, 11).then((hashedPassword) => {
          if (hashedPassword) {
            const codeToVerified = Math.floor(
              10000 + Math.random() * 90000
            ).toString();

            const hashedCodeToVerified = Buffer.from(
              codeToVerified,
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
              dateBirth: dateBirth,
              monthBirth: monthBirth,
            });
            const token = jwt.sign(
              {
                email: user.email,
                userId: user._id.toString(),
              },
              "nootisadmintoken12",
              {
                expiresIn: "7d",
              }
            );
            user.loginToken = token;
            return user.save();
          }
        });
      } else {
        const error = new Error("Użytkownik zajęty.");
        error.statusCode = 500;
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
        from: "nootis.help@gmail.com",
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
    .select("-phone -codeToVerified")
    .slice("alerts", 10)
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
      if (user) {
        bcrypt
          .compare(password, user.password)
          .then((doMatch) => {
            if (doMatch) {
              const token = jwt.sign(
                {
                  email: user.email,
                  userId: user._id.toString(),
                },
                "nootisadmintoken12",
                {
                  expiresIn: "7d",
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
    .select("-phone -name -surname -password -loginToken")
    .then((user) => {
      const unhashedCodeToVerified = Buffer.from(
        user.codeToVerified,
        "base64"
      ).toString("ascii");
      transporter.sendMail({
        to: user.email,
        from: "nootis.help@gmail.com",
        subject: "Tworzenie konta zakończone powodzeniem",
        html: `<h1>Utworzono nowe konto</h1> ${unhashedCodeToVerified}`,
      });
      res.status(201).json({
        message: "Email został wysłany",
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

exports.getUserPhone = (req, res, next) => {
  const userId = req.userId;
  User.findOne({
    _id: userId,
  })
    .select("-name -surname -password -loginToken -password -email")
    .then((user) => {
      const userPhone = Buffer.from(user.phone, "base64").toString("ascii");
      res.status(201).json({
        userPhone: userPhone,
      });
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
        err.message =
          "Brak podanej firmy.";
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
    .select("-phone -name -surname -password -loginToken -email")
    .then((user) => {
      if (user) {
        const unhashedCodeToVerified = Buffer.from(
          user.codeToVerified,
          "base64"
        ).toString("ascii");
        if (unhashedCodeToVerified === codeSent) {
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
      if (user) {
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
      if (user) {
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
    .select("-password -phone -codeToVerified")
    .slice("alerts", 10)
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
      if (user) {
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
    .select("-codeToVerified")
    .then((user) => {
      if (user) {
        // if (user.email === newEmail) {
        //   const error = new Error("Email jest taki sam");
        //   error.statusCode = 422;
        //   throw error;
        // }

        return bcrypt
          .compare(password, user.password)
          .then((doMatch) => {
            if (doMatch) {
              if (newPhone || newPassword) {
                const token = jwt.sign(
                  {
                    email: user.email,
                    userId: user._id.toString(),
                  },
                  "nootisadmintoken12",
                  {
                    expiresIn: "7d",
                  }
                );
                user.loginToken = token;
                if (newPhone) {
                  const hashedPhoneNumber = Buffer.from(
                    newPhone,
                    "utf-8"
                  ).toString("base64");
                  user.phone = hashedPhoneNumber;
                }
                if (newPassword) {
                  return bcrypt.hash(newPassword, 11).then((hashedPassword) => {
                    if (hashedPassword) {
                      user.password = hashedPassword;
                      return user;
                    }
                  });
                }
                return user;
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
          .then((resultUser) => {
            return resultUser.save();
          });
      } else {
        const error = new Error("Brak użytkownika");
        error.statusCode = 412;
        throw error;
      }
    })
    .then((result) => {
      const userName = Buffer.from(result.name, "base64").toString("ascii");
      const userSurname = Buffer.from(result.surname, "base64").toString(
        "ascii"
      );
      const userPhone = Buffer.from(result.phone, "base64").toString("ascii");
      res.status(201).json({
        userId: result._id.toString(),
        email: result.email,
        userName: userName,
        userSurname: userSurname,
        token: result.loginToken,
        accountVerified: result.accountVerified,
        hasCompany: result.hasCompany,
        company: result.company,
        userPhone: userPhone,
      });
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
    .select("-password -phone -codeToVerified")
    .then((user) => {
      if (user) {
        if (!!!user.codeToResetPassword) {
          const codeToReset = Math.floor(
            10000 + Math.random() * 90000
          ).toString();
          const hashedResetCode = Buffer.from(codeToReset, "utf-8").toString(
            "base64"
          );
          user.codeToResetPassword = hashedResetCode;
          return user.save();
        } else {
          return user;
        }
      }
    })
    .then((result) => {
      const codeToResetPassword = Buffer.from(
        result.codeToResetPassword,
        "base64"
      ).toString("ascii");

      transporter.sendMail({
        to: result.email,
        from: "nootis.help@gmail.com",
        subject: "Kod z kodem resetującym hasło an nootise",
        html: `<h1>Kod resetujący hasło</h1> ${codeToResetPassword}`,
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
    .select("-phone -codeToVerified")
    .then((user) => {
      if (user) {
        return bcrypt.hash(password, 11).then((hashedPassword) => {
          if (hashedPassword) {
            const token = jwt.sign(
              {
                email: user.email,
                userId: user._id.toString(),
              },
              "nootisadmintoken12",
              {
                expiresIn: "7d",
              }
            );
            user.loginToken = token;
            user.codeToResetPassword = null;
            user.password = hashedPassword;
            return user.save();
          }
        });
      } else {
        const error = new Error(
          "Brak użytkownika, lub kod resetujący jest błędny."
        );
        error.statusCode = 502;
        throw error;
      }
    })
    .then((result) => {
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
    .select("-name -surname -password -loginToken -password -email -phone")
    .then((user) => {
      user.company = companyId;
      user.hasCompany = true;
      return user.save();
    })
    .then((result) => {
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