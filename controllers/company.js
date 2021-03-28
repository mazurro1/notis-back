const Company = require("../models/company");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const CompanyAvailability = require("../models/companyAvailability");
const Reserwation = require("../models/reserwation");
const Opinion = require("../models/opinion");
const mongoose = require("mongoose");
const User = require("../models/user");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const getImgBuffer = require("../getImgBuffer");
require("dotenv").config();
const io = require("../socket");

const {
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  AWS_BUCKET,
  AWS_PATH_URL,
  SITE_FRONT,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_INFO,
  MAIL_PASSWORD,
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

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: true,
  auth: {
    user: MAIL_INFO,
    pass: MAIL_PASSWORD,
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

exports.registrationCompany = (req, res, next) => {
  const companyEmail = req.body.companyEmail;
  const companyName = req.body.companyName;
  const companyNumber = req.body.companyNumber;
  const companyCity = req.body.companyCity;
  const companyDiscrict = req.body.companyDiscrict;
  const companyAdress = req.body.companyAdress;
  const companyIndustries = req.body.companyIndustries;
  const companyNip = req.body.companyNip;
  const companyAdressCode = req.body.companyAdressCode;
  const ownerId = req.userId;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    name: companyName.toLowerCase(),
  })
    .select("name")
    .then((companyNameDoc) => {
      if (!!!companyNameDoc) {
        return Company.findOne({ email: companyEmail })
          .select(
            "-name -phone -adress -owner -workers -messages -messangerPageId -messangerAppId -messangerHtmlRef"
          )
          .then((companyDoc) => {
            if (!companyDoc) {
              const codeToVerified = makeid(6);

              const codeRandom = Math.floor(
                1000 + Math.random() * 9000
              ).toString();

              const hashedCodeToVerified = Buffer.from(
                codeToVerified,
                "utf-8"
              ).toString("base64");

              const hashedPhoneNumber = Buffer.from(
                companyNumber,
                "utf-8"
              ).toString("base64");

              const hashedAdress = Buffer.from(companyAdress, "utf-8").toString(
                "base64"
              );

              const newOpeningDays = {
                mon: {
                  disabled: false,
                  start: "10:00",
                  end: "20:00",
                },
                tue: {
                  disabled: false,
                  start: "10:00",
                  end: "20:00",
                },
                wed: {
                  disabled: false,
                  start: "10:00",
                  end: "20:00",
                },
                thu: {
                  disabled: false,
                  start: "10:00",
                  end: "20:00",
                },
                fri: {
                  disabled: false,
                  start: "10:00",
                  end: "20:00",
                },
                sat: {
                  disabled: true,
                  start: "0:00",
                  end: "0:00",
                },
                sun: {
                  disabled: true,
                  start: "0:00",
                  end: "0:00",
                },
              };
              const actualMonth = new Date().getMonth();
              const pathCompanyName = encodeURI(companyName);
              const company = new Company({
                linkPath: pathCompanyName + codeRandom,
                email: companyEmail.toLowerCase(),
                name: companyName.toLowerCase(),
                phone: hashedPhoneNumber,
                city: companyCity,
                district: companyDiscrict,
                adress: hashedAdress,
                accountVerified: false,
                codeToVerified: hashedCodeToVerified,
                owner: ownerId,
                ownerData: {
                  specialization: "Admin",
                },
                pauseCompany: true,
                allDataVerified: false,
                messangerAvaible: false,
                title: "",
                reservationEveryTime: 5,
                reservationMonthTime: 12,
                companyType: companyIndustries,
                openingDays: newOpeningDays,
                nip: companyNip,
                code: companyAdressCode,
                premium: new Date(new Date().setMonth(actualMonth + 3)),
                smsReserwationAvaible: false,
                smsNotifactionAvaible: false,
                smsCanceledAvaible: false,
              });

              return company.save();
            } else {
              const error = new Error("Email zajęty.");
              error.statusCode = 500;
              throw error;
            }
          })
          .then((result) => {
            return User.findOne({
              _id: ownerId,
              company: null,
              hasCompany: false,
            })
              .select("_id company hasCompany email")
              .then((user) => {
                if (!!user) {
                  user.company = result._id.toString();
                  user.hasCompany = true;
                  user.save();
                  return result;
                } else {
                  const error = new Error("Brak użytkownika.");
                  error.statusCode = 502;
                  throw error;
                }
              });
          })
          .then((result) => {
            const unhashedCodeToVerified = Buffer.from(
              result.codeToVerified,
              "base64"
            ).toString("ascii");
            transporter.sendMail({
              to: result.email,
              from: MAIL_INFO,
              subject: "Tworzenie konta firmowego zakończone powodzeniem",
              html: `<h1>Utworzono nowe konto firmowe</h1> ${unhashedCodeToVerified}`,
            });

            res.status(200).json({
              companyId: result._id.toString(),
            });
          });
      } else {
        const error = new Error("Nazwa firmy jest zajęta.");
        error.statusCode = 500;
        throw error;
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

exports.sentAgainVerifiedEmailCompany = (req, res, next) => {
  const companyId = req.body.companyId;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    accountVerified: false,
  })
    .select("email codeToVerified")
    .then((companyData) => {
      const unhashedCodeToVerified = Buffer.from(
        companyData.codeToVerified,
        "base64"
      ).toString("ascii");
      transporter.sendMail({
        to: companyData.email,
        from: MAIL_INFO,
        subject: "Tworzenie konta firmowego zakończone powodzeniem",
        html: `<h1>Utworzono nowe konto firmowe</h1> ${unhashedCodeToVerified}`,
      });
      res.status(201).json({
        message: "Email został wysłany",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Brak danego konta firmowego, lub konto zostało już aktywowane.";
      }
      next(err);
    });
};

exports.veryfiedCompanyEmail = (req, res, next) => {
  const companyId = req.body.companyId;
  const codeSent = req.body.codeToVerified;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    accountVerified: false,
  })
    .select("email codeToVerified accountVerified")
    .then((companyDoc) => {
      if (companyDoc) {
        const unhashedCodeToVerified = Buffer.from(
          companyDoc.codeToVerified,
          "base64"
        ).toString("ascii");

        if (unhashedCodeToVerified === codeSent) {
          companyDoc.codeToVerified = null;
          companyDoc.accountVerified = true;
          return companyDoc.save();
        } else {
          const error = new Error("Zły kod uwietrznienia.");
          error.statusCode = 403;
          throw error;
        }
      } else {
        const error = new Error("Brak konta firmowego.");
        error.statusCode = 422;
        throw error;
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
        err.message = "Brak konta firmowego, lub konto zostało już aktywowane.";
      }
      next(err);
    });
};

exports.getCompanyData = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    accountVerified: true,
  })
    .select(
      "-codeToVerified -raports -codeToActive -workers.noConstantWorkingHours -ownerData.noConstantWorkingHours"
    )
    .populate("owner", "name surname imageUrl")
    .populate("workers.user", "name surname email imageUrl")
    .then((companyDoc) => {
      if (companyDoc) {
        return Opinion.find({
          company: companyDoc._id,
        })
          .populate("user", "name")
          .populate({
            path: "reserwationId",
            select: "serviceName toWorkerUserId",
            populate: {
              path: "toWorkerUserId",
              select: "name surname",
            },
          })
          .limit(10)
          .sort({ createdAt: -1 })
          .then((resultOpinions) => {
            const companyOpinions = !!resultOpinions ? resultOpinions : [];
            let userHasPermission = userId == companyDoc.owner._id;
            if (!!!userHasPermission) {
              const workerSelected = companyDoc.workers.find(
                (worker) => worker.user._id == userId
              );
              if (!!workerSelected) {
                const workerHasAccess = workerSelected.permissions.some(
                  (perm) =>
                    perm === 2 ||
                    perm === 3 ||
                    perm === 4 ||
                    perm === 6 ||
                    perm === 7
                );
                if (workerHasAccess) {
                  userHasPermission = true;
                }
              }
            }
            if (!!userHasPermission) {
              const dataCompany = companyDoc;

              const unhashedOwnerName = Buffer.from(
                companyDoc.owner.name,
                "base64"
              ).toString("ascii");

              const unhashedOwnerSurname = Buffer.from(
                companyDoc.owner.surname,
                "base64"
              ).toString("ascii");

              const unhashedPhone = Buffer.from(
                companyDoc.phone,
                "base64"
              ).toString("ascii");

              const unhashedAdress = Buffer.from(
                companyDoc.adress,
                "base64"
              ).toString("ascii");

              let unhashedSMS = 0;
              if (!!companyDoc.sms) {
                unhashedSMS = Buffer.from(companyDoc.sms, "base64").toString(
                  "ascii"
                );
              }

              const mapedWorkers = [];
              dataCompany.workers.forEach((item) => {
                const unhashedName = Buffer.from(
                  item.user.name,
                  "base64"
                ).toString("ascii");
                const unhashedSurname = Buffer.from(
                  item.user.surname,
                  "base64"
                ).toString("ascii");
                const unhashedUserProps = {
                  email: item.email,
                  name: unhashedName,
                  surname: unhashedSurname,
                  _id: item.user._id,
                  imageUrl: item.user.imageUrl,
                };

                mapedWorkers.push({
                  _id: item._id,
                  user: unhashedUserProps,
                  active: item.active,
                  permissions: item.permissions,
                  specialization: item.specialization,
                  constantWorkingHours: item.constantWorkingHours
                    ? item.constantWorkingHours
                    : [],
                  noConstantWorkingHours: [],

                  servicesCategory: item.servicesCategory
                    ? item.servicesCategory
                    : [],
                });
              });

              const dataToSent = {
                ownerData: {
                  permissions: dataCompany.ownerData.permissions,
                  constantWorkingHours:
                    dataCompany.ownerData.constantWorkingHours,
                  noConstantWorkingHours: [],
                  specialization: dataCompany.ownerData.specialization,
                  servicesCategory: dataCompany.ownerData.servicesCategory,
                },
                openingDays: dataCompany.openingDays,
                _id: dataCompany._id,
                email: dataCompany.email,
                linkPath: dataCompany.linkPath,
                name: dataCompany.name,
                phone: unhashedPhone,
                city: dataCompany.city,
                district: dataCompany.district,
                adress: unhashedAdress,
                accountVerified: dataCompany.accountVerified,
                owner: {
                  name: unhashedOwnerName,
                  surname: unhashedOwnerSurname,
                  _id: dataCompany.owner._id,
                  imageUrl: dataCompany.owner.imageUrl,
                },
                pauseCompany: dataCompany.pauseCompany,
                messangerAvaible: dataCompany.messangerAvaible,
                title: dataCompany.title,
                reservationEveryTime: dataCompany.reservationEveryTime,
                workers: mapedWorkers,
                opinions: dataCompany.opinions,
                messages: dataCompany.messages,
                linkFacebook: dataCompany.linkFacebook,
                linkInstagram: dataCompany.linkInstagram,
                linkiWebsite: dataCompany.linkiWebsite,
                reserationText: dataCompany.reserationText,
                daysOff: dataCompany.daysOff,
                reservationMonthTime: dataCompany.reservationMonthTime,
                services: dataCompany.services,
                companyType: dataCompany.companyType,
                happyHoursConst: dataCompany.happyHoursConst,
                promotions: dataCompany.promotions,
                maps: dataCompany.maps,
                opinions: companyOpinions,
                opinionsCount: !!dataCompany.opinionsCount
                  ? dataCompany.opinionsCount
                  : 0,
                opinionsValue: !!dataCompany.opinionsValue
                  ? dataCompany.opinionsValue
                  : 0,
                imagesUrl: dataCompany.imagesUrl,
                mainImageUrl: dataCompany.mainImageUrl,
                companyStamps: dataCompany.companyStamps,
                shopStore: dataCompany.shopStore,
                code: dataCompany.code,
                premium: dataCompany.premium,
                sms: Number(unhashedSMS),
                smsReserwationAvaible: !!dataCompany.smsReserwationAvaible
                  ? dataCompany.smsReserwationAvaible
                  : false,
                smsNotifactionAvaible: !!dataCompany.smsNotifactionAvaible
                  ? dataCompany.smsNotifactionAvaible
                  : false,
                smsCanceledAvaible: !!dataCompany.smsCanceledAvaible
                  ? dataCompany.smsCanceledAvaible
                  : false,
              };

              res.status(201).json({
                companyProfil: dataToSent,
              });
            } else {
              const error = new Error("Brak uprawnień.");
              error.statusCode = 401;
              throw error;
            }
          });
      } else {
        const error = new Error("Brak konta firmowego.");
        error.statusCode = 422;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Brak konta firmowego, lub konto nie zostało zweryfikowane.";
      }
      next(err);
    });
};

exports.sentEmailToActiveCompanyWorker = (req, res, next) => {
  const companyId = req.body.companyId;
  const emailWorker = req.body.emailWorker;

  Company.findOne({
    _id: companyId,
  })
    .select("name workers email owner")
    .populate("workers.item.user", "name surname email")
    .populate("owner", "name surname email")
    .then((companyData) => {
      if (
        companyData.owner.email !== emailWorker &&
        companyData.email !== emailWorker
      ) {
        const isThisWorker = companyData.workers.some(
          (item) => item.email === emailWorker
        );
        const randomValue = makeid(6);

        const hashedRandomValue = Buffer.from(randomValue, "utf-8").toString(
          "base64"
        );

        if (!isThisWorker) {
          User.findOne({
            email: emailWorker,
            accountVerified: true,
            hasCompany: false,
            company: null,
          })
            .select("email")
            .then((userData) => {
              if (userData) {
                const newWorker = {
                  user: userData._id,
                  email: emailWorker,
                  active: false,
                  codeToActive: hashedRandomValue,
                  specialization: "",
                };
                companyData.workers.push(newWorker);
                return companyData.save();
              } else {
                const error = new Error("Brak użytkownika.");
                error.statusCode = 501;
                throw error;
              }
            })
            .then((result) => {
              const hashedEmail = Buffer.from(emailWorker, "utf-8").toString(
                "base64"
              );

              transporter.sendMail({
                to: emailWorker,
                from: MAIL_INFO,
                subject: `Potwierdzenie dodania do listy pracowników w firmie ${result.name}`,
                html: `<h1>Kliknij link aby potwierdzić</h1> <a href="${SITE_FRONT}/confirm-added-worker-to-company?${result._id}&${hashedEmail}&${hashedRandomValue}">kliknij tutaj</a>`,
              });

              res.status(201).json({
                message:
                  "Wysłano użytkownikowi wiadomość email do akceptacji zaproszenia do firmy",
              });
            })
            .catch((err) => {
              res.status(501).json({
                message: "Brak użytkwonika",
              });
            });
        } else {
          const error = new Error("Wysłano już email do aktywacji.");
          error.statusCode = 501;
          throw error;
        }
      } else {
        const error = new Error("Nie można użyć tego adresu email");
        error.statusCode = 422;
        throw error;
      }
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danego konta firmowego.";
      }
      next(err);
    });
};

exports.sentAgainEmailToActiveCompanyWorker = (req, res, next) => {
  const companyId = req.body.companyId;
  const emailWorker = req.body.emailWorker;

  Company.findOne({
    _id: companyId,
  })
    .select("name workers email owner")
    .populate("workers.item.user", "name surname email")
    .populate("owner", "name surname email")
    .then((companyData) => {
      if (
        companyData.owner.email !== emailWorker &&
        companyData.email !== emailWorker
      ) {
        const isThisWorker = companyData.workers.some(
          (item) => item.email === emailWorker
        );
        if (isThisWorker) {
          const thisWorker = companyData.workers.find(
            (item) => item.email === emailWorker && item.active === false
          );

          const hashedEmail = Buffer.from(emailWorker, "utf-8").toString(
            "base64"
          );

          transporter.sendMail({
            to: emailWorker,
            from: MAIL_INFO,
            subject: `Potwierdzenie dodania do listy pracowników w firmie ${companyData.name}`,
            html: `<h1>Kliknij link aby potwierdzić</h1> <a href="${SITE_FRONT}/confirm-added-worker-to-company?${companyData._id}&${hashedEmail}&${thisWorker.codeToActive}">kliknij tutaj</a>`,
          });

          res.status(201).json({
            message:
              "Wysłano ponownie użytkownikowi wiadomość email do akceptacji zaproszenia do firmy",
          });
        } else {
          const error = new Error(
            "Podany użytkownik nie został dodany do listy pracowników."
          );
          error.statusCode = 501;
          throw error;
        }
      } else {
        const error = new Error("Nie można użyć tego adresu email");
        error.statusCode = 422;
        throw error;
      }
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message =
          "Brak danego konta pracownika lub konto zostało już aktywowane.";
      }
      next(err);
    });
};

exports.emailActiveCompanyWorker = (req, res, next) => {
  const companyId = req.body.companyId;
  const workerEmail = req.body.workerEmail;
  const codeToActive = req.body.codeToActive;

  const unhashedWorkerEmail = Buffer.from(workerEmail, "base64").toString(
    "ascii"
  );

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
  })
    .select("name workers email _id owner email")
    .populate("workers.item.user", "name surname email")
    .then((companyDoc) => {
      if (!!companyDoc) {
        const unhashedCodeFromClient = Buffer.from(
          codeToActive,
          "base64"
        ).toString("ascii");

        const indexSelectWorker = companyDoc.workers.findIndex(
          (item) => item.email === unhashedWorkerEmail
        );
        const selectWorker = companyDoc.workers.find(
          (item) => item.email === unhashedWorkerEmail
        );
        if (!!selectWorker) {
          const unhashedCodeFromBase = Buffer.from(
            selectWorker.codeToActive,
            "base64"
          ).toString("ascii");
          if (unhashedCodeFromBase === unhashedCodeFromClient) {
            selectWorker.active = true;
            selectWorker.codeToActive = null;
            selectWorker.servicesCategory = [];
            companyDoc.workers[indexSelectWorker] = selectWorker;
            return companyDoc.save();
          } else {
            const error = new Error("Zły kod aktywacji.");
            error.statusCode = 501;
            throw error;
          }
        } else {
          const error = new Error("Brak podanego pracownika do aktywacji.");
          error.statusCode = 501;
          throw error;
        }
      } else {
        const error = new Error("Brak konta firmowego.");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((result) => {
      User.findOne({
        email: unhashedWorkerEmail,
      })
        .select("email company hasCompany")
        .then((userDocUpdate) => {
          if (userDocUpdate) {
            userDocUpdate.company = result._id;
            userDocUpdate.hasCompany = true;
            return userDocUpdate.save();
          } else {
            const error = new Error(
              "Błąd podczas dodawania użytkownikowi firmy."
            );
            error.statusCode = 501;
            throw error;
          }
        });
    })
    .then(() => {
      res.status(201).json({
        message: "Użytkownik został dodany do firmy",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas aktywowania użytkownika.";
      }
      next(err);
    });
};

exports.deleteWorkerFromCompany = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const workerUserId = req.body.workerUserId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
  })
    .select("name _id owner")
    .then((companyDoc) => {
      if (!!companyDoc) {
        if (companyDoc.owner == userId) {
          return Company.updateOne(
            {
              _id: companyId,
            },
            {
              $pull: {
                workers: { user: workerUserId },
              },
            }
          )
            .then(() => {
              return companyDoc;
            })
            .catch(() => {
              const error = new Error("Nie można usunąć pracownika.");
              error.statusCode = 501;
              throw error;
            });
        } else {
          const error = new Error("Brak uprawnień.");
          error.statusCode = 501;
          throw error;
        }
      } else {
        const error = new Error("Brak firmy.");
        error.statusCode = 501;
        throw error;
      }
    })
    .then(() => {
      return User.findOne({
        _id: workerUserId,
      })
        .select("email hasCompany company _id")
        .then((userDoc) => {
          if (!!userDoc) {
            userDoc.hasCompany = false;
            userDoc.company = null;
            return userDoc.save();
          } else {
            const error = new Error("Nie znaleziono pracownika.");
            error.statusCode = 501;
            throw error;
          }
        });
    })
    .then((userDoc) => {
      return Reserwation.aggregate([
        {
          $match: {
            toWorkerUserId: mongoose.Types.ObjectId(userDoc._id),
            company: mongoose.Types.ObjectId(companyId),
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
      ]).then((allReserwations) => {
        const allUsersReserwations = [];
        const allWorkerReserwations = [];
        const bulkArrayToUpdate = [];
        allReserwations.forEach((item) => {
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
            (reserwation) => reserwation.userId == item.fromUser._id
          );
          if (findUserReserwations >= 0) {
            allUsersReserwations[findUserReserwations].items.push(item);
          } else {
            const newUserData = {
              userId: item.fromUser._id,
              items: [item],
            };
            allUsersReserwations.push(newUserData);
          }
          const findWorkerReserwations = allWorkerReserwations.findIndex(
            (reserwation) =>
              reserwation.workerUserId.toString() ==
              item.toWorkerUserId._id.toString()
          );
          if (findWorkerReserwations >= 0) {
            allWorkerReserwations[findWorkerReserwations].items.push(item);
          } else {
            const newUserData = {
              workerUserId: item.toWorkerUserId._id,
              items: [item],
            };
            allWorkerReserwations.push(newUserData);
          }
        });
        return Reserwation.bulkWrite(bulkArrayToUpdate)
          .then(() => {
            return {
              allUsersReserwation: allUsersReserwations,
              allWorkerReserwations: allWorkerReserwations,
            };
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
    .then(({ allUsersReserwation, allWorkerReserwations }) => {
      const bulkArrayToUpdate = [];
      allUsersReserwation.forEach((userDoc) => {
        const allUserAlertsToSave = [];

        userDoc.items.forEach((itemReserwation) => {
          const userAlertToSave = {
            reserwationId: itemReserwation._id,
            active: true,
            type: "rezerwation_canceled",
            creationTime: new Date(),
            companyChanged: true,
          };

          io.getIO().emit(`user${userDoc.userId}`, {
            action: "update-alerts",
            alertData: {
              reserwationId: itemReserwation,
              active: true,
              type: "rezerwation_canceled",
              creationTime: new Date(),
              companyChanged: true,
            },
          });

          allUserAlertsToSave.push(userAlertToSave);
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
      allWorkerReserwations.forEach((userDoc) => {
        const allWorkerAlertsToSave = [];

        userDoc.items.forEach((itemReserwation) => {
          const userAlertToSave = {
            reserwationId: itemReserwation._id,
            active: true,
            type: "rezerwation_canceled",
            creationTime: new Date(),
            companyChanged: true,
          };

          io.getIO().emit(`user${userDoc.workerUserId}`, {
            action: "update-alerts",
            alertData: {
              reserwationId: itemReserwation,
              active: true,
              type: "rezerwation_canceled",
              creationTime: new Date(),
              companyChanged: true,
            },
          });

          allWorkerAlertsToSave.push(userAlertToSave);
        });

        bulkArrayToUpdate.push({
          updateOne: {
            filter: {
              _id: userDoc.workerUserId,
            },
            update: {
              $inc: { alertActiveCount: allWorkerAlertsToSave.length },
              $push: {
                alerts: {
                  $each: allWorkerAlertsToSave,
                  $position: 0,
                },
              },
            },
          },
        });
      });
      return User.bulkWrite(bulkArrayToUpdate)
        .then(() => {
          res.status(201).json({
            message: "Użytkownik został usunięty",
          });
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas wysyłania powiadomień.";
          }
          next(err);
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

exports.companyPath = (req, res, next) => {
  const companyPath = req.body.companyPath;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    linkPath: companyPath,
  })
    .select(
      "premium shopStore companyStamps mainImageUrl imagesUrl workers._id workers.specialization workers.name workers.servicesCategory adress city district email linkFacebook linkInstagram linkPath linkiWebsite name daysOff openingDays owner ownerData pauseCompany phone reserationText services title reservationMonthTime usersInformation.isBlocked usersInformation.userId maps opinionsCount opinionsValue code"
    )
    .populate("owner", "name surname imageUrl")
    .populate("workers.user", "name surname email imageUrl")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        Opinion.find({
          company: resultCompanyDoc._id,
        })
          .populate("user", "name")
          .populate({
            path: "reserwationId",
            select: "serviceName toWorkerUserId",
            populate: {
              path: "toWorkerUserId",
              select: "name surname",
            },
          })
          .limit(10)
          .sort({ createdAt: -1 })
          .then((resultOpinions) => {
            const companyOpinions = !!resultOpinions ? resultOpinions : [];
            const dataCompany = resultCompanyDoc;

            const unhashedOwnerName = Buffer.from(
              resultCompanyDoc.owner.name,
              "base64"
            ).toString("ascii");

            const unhashedOwnerSurname = Buffer.from(
              resultCompanyDoc.owner.surname,
              "base64"
            ).toString("ascii");

            const unhashedPhone = Buffer.from(
              resultCompanyDoc.phone,
              "base64"
            ).toString("ascii");

            const unhashedAdress = Buffer.from(
              resultCompanyDoc.adress,
              "base64"
            ).toString("ascii");

            const mapedWorkers = dataCompany.workers.map((item) => {
              const unhashedName = Buffer.from(
                item.user.name,
                "base64"
              ).toString("ascii");
              const unhashedSurname = Buffer.from(
                item.user.surname,
                "base64"
              ).toString("ascii");
              const unhashedUserProps = {
                email: item.email,
                name: unhashedName,
                surname: unhashedSurname,
                _id: item.user._id,
                imageUrl: item.user.imageUrl,
              };

              return {
                user: unhashedUserProps,
                active: item.active,
                specialization: item.specialization,
                servicesCategory: item.servicesCategory
                  ? item.servicesCategory
                  : [],
                _id: item._id,
              };
            });

            const dataToSent = {
              adress: unhashedAdress,
              city: resultCompanyDoc.city,
              district: resultCompanyDoc.district,
              email: resultCompanyDoc.email,
              linkFacebook: resultCompanyDoc.linkFacebook,
              linkInstagram: resultCompanyDoc.linkInstagram,
              linkPath: resultCompanyDoc.linkPath,
              linkiWebsite: resultCompanyDoc.linkWebsite,
              name: resultCompanyDoc.name,
              openingDays: resultCompanyDoc.openingDays,
              owner: {
                name: unhashedOwnerName,
                surname: unhashedOwnerSurname,
                _id: resultCompanyDoc.owner._id,
                imageUrl: resultCompanyDoc.owner.imageUrl,
              },
              ownerData: {
                active: resultCompanyDoc.ownerData.active,
                servicesCategory: resultCompanyDoc.ownerData.servicesCategory,
                specialization: resultCompanyDoc.ownerData.specialization,
                user: resultCompanyDoc.ownerData.user,
              },
              pauseCompany: resultCompanyDoc.pauseCompany,
              phone: unhashedPhone,
              reserationText: resultCompanyDoc.reserationText,
              services: resultCompanyDoc.services,
              title: resultCompanyDoc.title,
              workers: mapedWorkers,
              _id: resultCompanyDoc._id,
              reservationMonthTime: resultCompanyDoc.reservationMonthTime,
              usersInformation: resultCompanyDoc.usersInformation,
              maps: resultCompanyDoc.maps,
              opinionsCount: !!resultCompanyDoc.opinionsCount
                ? resultCompanyDoc.opinionsCount
                : 0,
              opinionsValue: !!resultCompanyDoc.opinionsValue
                ? resultCompanyDoc.opinionsValue
                : 0,
              opinions: companyOpinions,
              premium: resultCompanyDoc.premium,
              imagesUrl: resultCompanyDoc.imagesUrl,
              mainImageUrl: resultCompanyDoc.mainImageUrl,
              companyStamps: resultCompanyDoc.companyStamps,
              shopStore: resultCompanyDoc.shopStore,
              code: resultCompanyDoc.code,
              daysOff: resultCompanyDoc.daysOff,
            };

            res.status(201).json({
              companyDoc: dataToSent,
            });
          })
          .catch((err) => {
            if (!err.statusCode) {
              err.statusCode = 501;
              err.message = "Błąd podczas pobierania danych.";
            }
            next(err);
          });
      } else {
        const error = new Error("Brak wybranej firmy.");
        error.statusCode = 403;
        throw error;
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

exports.allCompanys = (req, res, next) => {
  const page = req.body.page;
  const sorts = req.body.sorts;
  const filters = req.body.filters;
  const localization = req.body.localization;
  const selectedName = req.body.selectedName;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const localizationValid = !!localization ? localization.value : null;
  const filtersValid = !!filters ? filters.value : null;
  const regexFilterCity = new RegExp(
    ["^", localizationValid, "$"].join(""),
    "i"
  );

  const propsFilterCity = !!localizationValid
    ? { city: { $in: [regexFilterCity] } }
    : {};

  const propsFilterFilters = !!filtersValid
    ? {
        "services.serviceName": {
          $regex: new RegExp(filtersValid, "i"),
        },
      }
    : {};

  const validSelectedName = !!selectedName ? selectedName : null;

  const propsSelectedName = !!validSelectedName
    ? { name: { $regex: new RegExp(validSelectedName, "i") } }
    : {};

  const sortValid = !!sorts ? sorts : "mostlyRated";
  const propsSort = !!sortValid
    ? sortValid === "aToZ"
      ? { name: 1 }
      : sortValid === "zToA"
      ? { name: -1 }
      : sortValid === "mostlyRated"
      ? { opinionsCount: -1 }
      : sortValid === ""
      ? { opinionsValue: -1 }
      : {}
    : {};

  Company.find({
    ...propsFilterCity,
    ...propsFilterFilters,
    ...propsSelectedName,
    accountVerified: true,
    pauseCompany: false,
    premium: {
      $gte: new Date().toISOString(),
    },
  })

    .select(
      "adress city district linkPath name pauseCompany reserationText services title opinionsCount opinionsValue mainImageUrl imagesUrl code"
    )

    .skip((page - 1) * 10)
    .limit(10)
    .sort(propsSort)
    .then((resultCompanyDoc) => {
      if (resultCompanyDoc.length > 0) {
        const allCompanysToSent = [];
        resultCompanyDoc.forEach((itemCompany) => {
          const unhashedAdress = Buffer.from(
            itemCompany.adress,
            "base64"
          ).toString("ascii");

          const dataToSent = {
            adress: unhashedAdress,
            city: itemCompany.city,
            district: itemCompany.district,
            linkPath: itemCompany.linkPath,
            name: itemCompany.name,
            services: itemCompany.services,
            code: itemCompany.code,
            title: itemCompany.title,
            _id: itemCompany._id,
            mainImageUrl: itemCompany.mainImageUrl,
            imagesUrl: itemCompany.imagesUrl,
            opinionsCount: !!itemCompany.opinionsCount
              ? itemCompany.opinionsCount
              : 0,
            opinionsValue: !!itemCompany.opinionsValue
              ? itemCompany.opinionsValue
              : 0,
          };
          allCompanysToSent.push(dataToSent);
        });
        res.status(201).json({
          companysDoc: allCompanysToSent,
        });
      } else {
        const error = new Error("Brak dancyh do pobrania.");
        error.statusCode = 403;
        throw error;
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

exports.allCompanysOfType = (req, res, next) => {
  const page = req.body.page;
  const type = req.body.type;
  const sorts = req.body.sorts;
  const filters = req.body.filters;
  const localization = req.body.localization;
  const selectedName = req.body.selectedName;

  const localizationValid = !!localization ? localization.value : null;
  const filtersValid = !!filters ? filters.value : null;
  const regexFilterCity = new RegExp(
    ["^", localizationValid, "$"].join(""),
    "i"
  );

  const propsFilterCity = !!localizationValid
    ? { city: { $in: [regexFilterCity] } }
    : {};

  const propsFilterFilters = !!filtersValid
    ? {
        "services.serviceName": {
          $regex: new RegExp(filtersValid, "i"),
        },
      }
    : {};

  const sortValid = !!sorts ? sorts : "mostlyRated";
  const propsSort = !!sortValid
    ? sortValid === "aToZ"
      ? { name: 1 }
      : sortValid === "zToA"
      ? { name: -1 }
      : sortValid === "mostlyRated"
      ? { opinionsCount: -1 }
      : sortValid === ""
      ? { opinionsValue: -1 }
      : {}
    : {};

  const validSelectedName = !!selectedName ? selectedName : null;

  const propsSelectedName = !!validSelectedName
    ? { name: { $regex: new RegExp(validSelectedName, "i") } }
    : {};

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.find({
    companyType: type,
    ...propsFilterCity,
    ...propsFilterFilters,
    ...propsSelectedName,
    accountVerified: true,
    pauseCompany: false,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select(
      "adress city district linkPath name services title opinionsCount opinionsValue mainImageUrl imagesUrl code"
    )
    .skip((page - 1) * 10)
    .limit(10)
    .sort(propsSort)
    .then((resultCompanyDoc) => {
      if (resultCompanyDoc.length > 0) {
        const allCompanysToSent = [];
        resultCompanyDoc.forEach((itemCompany) => {
          const unhashedAdress = Buffer.from(
            itemCompany.adress,
            "base64"
          ).toString("ascii");

          const dataToSent = {
            adress: unhashedAdress,
            city: itemCompany.city,
            district: itemCompany.district,
            linkPath: itemCompany.linkPath,
            name: itemCompany.name,
            services: itemCompany.services,
            code: itemCompany.code,
            title: itemCompany.title,
            _id: itemCompany._id,
            mainImageUrl: itemCompany.mainImageUrl,
            imagesUrl: itemCompany.imagesUrl,
            opinionsCount: !!itemCompany.opinionsCount
              ? itemCompany.opinionsCount
              : 0,
            opinionsValue: !!itemCompany.opinionsValue
              ? itemCompany.opinionsValue
              : 0,
          };
          allCompanysToSent.push(dataToSent);
        });
        res.status(201).json({
          companysDoc: allCompanysToSent,
        });
      } else {
        const error = new Error("Brak dancyh do pobrania.");
        error.statusCode = 403;
        throw error;
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

exports.companyUsersInformationsBlock = (req, res, next) => {
  const userId = req.userId;
  const selectedUserId = req.body.selectedUserId;
  const companyId = req.body.companyId;
  const isBlocked = req.body.isBlocked;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id usersInformation workers.permissions workers.user owner")
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
          const selectUserInformation = resultCompanyDoc.usersInformation.findIndex(
            (item) => item.userId == selectedUserId
          );
          if (selectUserInformation >= 0) {
            resultCompanyDoc.usersInformation[
              selectUserInformation
            ].isBlocked = isBlocked;
          } else {
            resultCompanyDoc.usersInformation.push({
              userId: selectedUserId,
              isBlocked: true,
            });
          }
          return resultCompanyDoc.save();
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
    .then(() => {
      res.status(201).json({
        message: "User blocked",
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

exports.companyServicesPatch = (req, res, next) => {
  const userId = req.userId;
  const services = req.body.services;
  const companyId = req.body.companyId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select(
      "_id workers.permissions workers.user workers.servicesCategory ownerData.servicesCategory owner services promotions happyHoursConst companyStamps"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 2
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      if (services.deleted.length > 0) {
        const newArray = companyDoc.services.filter((itemFirst) => {
          const isInArray = services.deleted.some((itemSecond) => {
            return itemSecond == itemFirst._id;
          });
          return !isInArray;
        });
        companyDoc.services = newArray;

        //delete serwice from worker
        companyDoc.workers.forEach((worker, index) => {
          const filterWorkerServiceCategory = worker.servicesCategory.filter(
            (service) => {
              const isServiceInDeleted = services.deleted.some(
                (itemDeleted) => {
                  return itemDeleted === service;
                }
              );
              return !isServiceInDeleted;
            }
          );
          companyDoc.workers[
            index
          ].servicesCategory = filterWorkerServiceCategory;
        });

        //delete from owner
        const filterOwnerServiceCategory = companyDoc.ownerData.servicesCategory.filter(
          (service) => {
            const isServiceInDeleted = services.deleted.some(
              (itemDeletedOwner) => {
                return itemDeletedOwner === service;
              }
            );
            return !isServiceInDeleted;
          }
        );

        companyDoc.ownerData.servicesCategory = filterOwnerServiceCategory;

        //delete from happy hours
        const newHappyHours = [];
        companyDoc.happyHoursConst.forEach((happyHour) => {
          const isServiceInHappyHour = happyHour.servicesInPromotion.some(
            (happyHourService) => {
              const isInDeleted = services.deleted.some(
                (serviceDeleted) => serviceDeleted == happyHourService
              );
              return isInDeleted;
            }
          );
          if (isServiceInHappyHour) {
            const filterServiceInHappyHour = happyHour.servicesInPromotion.filter(
              (happyHourService) => {
                const isInDeleted = services.deleted.some((serviceDeleted) => {
                  return serviceDeleted == happyHourService;
                });
                return !isInDeleted;
              }
            );
            if (filterServiceInHappyHour.length > 0) {
              const newHappyHoursItemService = {
                dayWeekIndex: happyHour.dayWeekIndex,
                servicesInPromotion: filterServiceInHappyHour,
                _id: happyHour._id,
                disabled: happyHour.disabled,
                start: happyHour.start,
                end: happyHour.end,
                promotionPercent: happyHour.promotionPercent,
              };

              newHappyHours.push(newHappyHoursItemService);
            }
          } else {
            newHappyHours.push(happyHour);
          }
        });
        companyDoc.happyHoursConst = newHappyHours;

        //delete from promotions
        const newPromotions = [];
        companyDoc.promotions.forEach((promotion) => {
          const isServiceInPromotion = promotion.servicesInPromotion.some(
            (promotionService) => {
              const isInDeleted = services.deleted.some(
                (serviceDeleted) => serviceDeleted == promotionService
              );
              return isInDeleted;
            }
          );
          if (isServiceInPromotion) {
            const filterServiceInPromotion = promotion.servicesInPromotion.filter(
              (promotionService) => {
                const isInDeleted = services.deleted.some((serviceDeleted) => {
                  return serviceDeleted == promotionService;
                });
                return !isInDeleted;
              }
            );
            if (filterServiceInPromotion.length > 0) {
              const newPromotionItemService = {
                dayWeekIndex: promotion.dayWeekIndex,
                servicesInPromotion: filterServiceInPromotion,
                _id: promotion._id,
                disabled: promotion.disabled,
                start: promotion.start,
                end: promotion.end,
                promotionPercent: promotion.promotionPercent,
              };

              newPromotions.push(newPromotionItemService);
            }
          } else {
            newPromotions.push(promotion);
          }
        });

        companyDoc.promotions = newPromotions;

        //delete service in stamps companyStamps
        const newStamps = [];
        companyDoc.companyStamps.forEach((stamp) => {
          const isServiceInStamp = stamp.servicesId.some((stampService) => {
            const isInDeleted = services.deleted.some(
              (serviceDeleted) => serviceDeleted == stampService
            );
            return isInDeleted;
          });

          if (isServiceInStamp) {
            const filterServiceInStamp = stamp.servicesId.filter(
              (stampService) => {
                const isInDeleted = services.deleted.some((serviceDeleted) => {
                  return serviceDeleted == stampService;
                });
                return !isInDeleted;
              }
            );

            if (filterServiceInStamp.length > 0) {
              const newStampsItemService = {
                servicesId: filterServiceInStamp,
                _id: stamp._id,
                disabled: stamp.disabled,
                countStampsToActive: stamp.countStampsToActive,
                promotionPercent: stamp.promotionPercent,
              };

              newStamps.push(newStampsItemService);
            }
          } else {
            newStamps.push(stamp);
          }
        });
        companyDoc.companyStamps = newStamps;
      }
      //end deleted in promotions

      // edited services
      if (services.edited.length > 0) {
        const newServices = companyDoc.services.map((itemFirst) => {
          const isInArray = services.edited.some((itemSecond) => {
            return itemSecond._id == itemFirst._id;
          });
          if (isInArray) {
            const findItem = services.edited.find((itemSecond) => {
              return itemSecond._id == itemFirst._id;
            });
            findItem._id = itemFirst._id;
            return findItem;
          } else {
            return itemFirst;
          }
        });
        companyDoc.services = newServices;
      }

      if (services.new.length > 0) {
        services.new.forEach((item) => {
          const newItem = {
            serviceCategory: item.serviceCategory,
            serviceName: item.serviceName,
            serviceText: item.serviceText,
            serviceCost: item.serviceCost,
            extraCost: item.extraCost,
            time: item.time,
            extraTime: item.extraTime,
            serviceColor: item.serviceColor,
          };
          companyDoc.services.push(newItem);
        });
      }
      return companyDoc.save();
    })
    .then((companySave) => {
      res.status(201).json({
        services: companySave.services,
        ownerDataServices: companySave.ownerData.servicesCategory,
        workers: companySave.workers,
        promotions: companySave.promotions,
        happyHoursConst: companySave.happyHoursConst,
        companyStamps: companySave.companyStamps,
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

exports.companySettingsPatch = (req, res, next) => {
  const userId = req.userId;
  const dataSettings = req.body.dataSettings;
  const companyId = req.body.companyId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select(
      "_id workers.permissions workers.user owner city district adress phone name companyType pauseCompany reservationMonthTime reservationEveryTime"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      if (!!dataSettings.updateNompanyNameInput) {
        return Company.findOne({
          name: dataSettings.updateNompanyNameInput.toLowerCase(),
        })
          .then((resultCompanyName) => {
            if (!!!resultCompanyName) {
              companyDoc.name = dataSettings.updateNompanyNameInput;
              return companyDoc.save();
            } else {
              const error = new Error("Nazwa firmy jest zajęta.");
              error.statusCode = 403;
              throw error;
            }
          })
          .catch((err) => {
            if (!err.statusCode) {
              err.statusCode = 501;
              err.message = "Błąd podczas pobierania danych.";
            }
            next(err);
          });
      } else {
        return companyDoc;
      }
    })
    .then((companyDoc) => {
      if (!!dataSettings.updateCityInput) {
        companyDoc.city = dataSettings.updateCityInput;
      }

      if (!!dataSettings.updateCodeInput) {
        companyDoc.code = dataSettings.updateCodeInput;
      }

      if (!!dataSettings.updateDiscrictInput) {
        companyDoc.district = dataSettings.updateDiscrictInput;
      }

      if (!!dataSettings.updateAdressInput) {
        const hashedAdress = Buffer.from(
          dataSettings.updateAdressInput,
          "utf-8"
        ).toString("base64");
        companyDoc.adress = hashedAdress;
      }

      if (!!dataSettings.updatePhoneInput) {
        const hashedPhoneNumber = Buffer.from(
          dataSettings.updatePhoneInput,
          "utf-8"
        ).toString("base64");
        companyDoc.phone = hashedPhoneNumber;
      }

      if (!!dataSettings.industriesComponent) {
        if (dataSettings.industriesComponent != companyDoc.companyType) {
          companyDoc.companyType = dataSettings.industriesComponent;
        }
      }

      if (dataSettings.pauseCompanyToServer !== null) {
        companyDoc.pauseCompany = dataSettings.pauseCompanyToServer;
      }

      if (!!dataSettings.reserwationMonthToServer) {
        companyDoc.reservationMonthTime = dataSettings.reserwationMonthToServer;
      }

      if (!!dataSettings.reserwationEverToServer) {
        companyDoc.reservationEveryTime = dataSettings.reserwationEverToServer;
      }

      return companyDoc.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Zaktualizowano ustawienia firmy",
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

exports.companyWorkersSaveProps = (req, res, next) => {
  const userId = req.userId;
  const dateProps = req.body.dateProps;
  const companyId = req.body.companyId;
  const constTime = req.body.constTime;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers owner ownerData")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 4
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      if (!!dateProps) {
        if (dateProps.workerId === "owner") {
          companyDoc.ownerData.specialization =
            dateProps.inputSpecializationValue;
          companyDoc.ownerData.permissions = dateProps.mapWorkerPermissionsIds;
          companyDoc.ownerData.servicesCategory =
            dateProps.workerServicesCategoryValue;
        } else {
          const selectedWorkerIndex = companyDoc.workers.findIndex(
            (item) => item._id == dateProps.workerId
          );
          if (selectedWorkerIndex >= 0) {
            companyDoc.workers[selectedWorkerIndex].specialization =
              dateProps.inputSpecializationValue;
            companyDoc.workers[selectedWorkerIndex].permissions =
              dateProps.mapWorkerPermissionsIds;
            companyDoc.workers[selectedWorkerIndex].servicesCategory =
              dateProps.workerServicesCategoryValue;
          }
        }
      }
      if (!!constTime) {
        if (constTime.indexWorker === "owner") {
          if (constTime.constantWorkingHours.length > 0) {
            constTime.constantWorkingHours.forEach((constDate) => {
              const dateIsInBackend = companyDoc.ownerData.constantWorkingHours.findIndex(
                (item) => item.dayOfTheWeek === constDate.dayOfTheWeek
              );
              if (dateIsInBackend >= 0) {
                companyDoc.ownerData.constantWorkingHours[
                  dateIsInBackend
                ].dayOfTheWeek = constDate.dayOfTheWeek;
                companyDoc.ownerData.constantWorkingHours[
                  dateIsInBackend
                ].startWorking = constDate.startWorking;
                companyDoc.ownerData.constantWorkingHours[
                  dateIsInBackend
                ].endWorking = constDate.endWorking;
                companyDoc.ownerData.constantWorkingHours[
                  dateIsInBackend
                ].disabled = constDate.disabled;
              } else {
                companyDoc.ownerData.constantWorkingHours.push(constDate);
              }
            });
          }
        } else {
          const selectedWorkerIndex = companyDoc.workers.findIndex(
            (item) => item._id == constTime.indexWorker
          );
          if (selectedWorkerIndex >= 0) {
            if (constTime.constantWorkingHours.length > 0) {
              constTime.constantWorkingHours.forEach((constDate) => {
                const dateIsInBackend = companyDoc.workers[
                  selectedWorkerIndex
                ].constantWorkingHours.findIndex(
                  (item) => item.dayOfTheWeek === constDate.dayOfTheWeek
                );
                if (dateIsInBackend >= 0) {
                  companyDoc.workers[selectedWorkerIndex].constantWorkingHours[
                    dateIsInBackend
                  ].dayOfTheWeek = constDate.dayOfTheWeek;
                  companyDoc.workers[selectedWorkerIndex].constantWorkingHours[
                    dateIsInBackend
                  ].startWorking = constDate.startWorking;
                  companyDoc.workers[selectedWorkerIndex].constantWorkingHours[
                    dateIsInBackend
                  ].endWorking = constDate.endWorking;
                  companyDoc.workers[selectedWorkerIndex].constantWorkingHours[
                    dateIsInBackend
                  ].disabled = constDate.disabled;
                } else {
                  companyDoc.workers[
                    selectedWorkerIndex
                  ].constantWorkingHours.push(constDate);
                }
              });
            }
          }
        }
      }
      return companyDoc.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Zaktualizowano ustawienia pracownika",
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

exports.companyWorkersNoConstData = (req, res, next) => {
  const userId = req.userId;
  const workerId = req.body.workerId;
  const companyId = req.body.companyId;
  const year = req.body.year;
  const month = req.body.month;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(companyId),
        "workers._id": mongoose.Types.ObjectId(workerId),
      },
    },
    { $unwind: "$workers" },
    {
      $project: {
        _id: 1,
        owner: 1,
        workers: {
          permissions: 1,
          user: 1,
          _id: 1,
          noConstantWorkingHours: {
            $filter: {
              input: "$workers.noConstantWorkingHours",
              as: "item",
              cond: {
                $and: [
                  { $eq: ["$$item.month", month] },
                  { $eq: ["$$item.year", year] },
                ],
              },
            },
          },
        },
      },
    },
  ])
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        const findWorkerResultId = resultCompanyDoc.findIndex((item) => {
          return item.workers._id == workerId;
        });
        if (findWorkerResultId >= 0) {
          let hasPermission =
            resultCompanyDoc[findWorkerResultId].owner == userId;
          if (!hasPermission) {
            hasPermission = resultCompanyDoc[
              findWorkerResultId
            ].workers.permissions.some((perm) => perm === 4);
          }
          if (hasPermission) {
            return {
              resultCompanyDoc: resultCompanyDoc,
              findWorkerResultId: findWorkerResultId,
            };
          } else {
            const error = new Error("Brak dostępu.");
            error.statusCode = 401;
            throw error;
          }
        } else {
          const error = new Error("Brak pracownika.");
          error.statusCode = 403;
          throw error;
        }
      } else {
        const error = new Error("Brak wybranej firmy.");
        error.statusCode = 403;
        throw error;
      }
    })
    .then((result) => {
      res.status(201).json({
        noConstWorkingHours:
          result.resultCompanyDoc[result.findWorkerResultId].workers
            .noConstantWorkingHours,
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

exports.companyOwnerNoConstData = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const year = req.body.year;
  const month = req.body.month;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(companyId),
        owner: mongoose.Types.ObjectId(userId),
      },
    },
    { $unwind: "$ownerData" },
    {
      $project: {
        _id: 1,
        owner: 1,
        ownerData: {
          permissions: 1,
          noConstantWorkingHours: {
            $filter: {
              input: "$ownerData.noConstantWorkingHours",
              as: "itemOwner",
              cond: {
                $and: [
                  { $eq: ["$$itemOwner.month", month] },
                  { $eq: ["$$itemOwner.year", year] },
                ],
              },
            },
          },
        },
        workers: {
          _id: 1,
          permissions: 1,
        },
      },
    },
  ])
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc[0].owner == userId;
        if (!hasPermission) {
          hasPermission = resultCompanyDoc[0].workers.permissions.some(
            (perm) => perm === 4
          );
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      res.status(201).json({
        noConstWorkingHours:
          resultCompanyDoc[0].ownerData.noConstantWorkingHours,
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

exports.companyWorkersAddNoConstData = (req, res, next) => {
  const userId = req.userId;
  const workerId = req.body.workerId;
  const companyId = req.body.companyId;
  const newDate = req.body.newDate;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers owner ownerData")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 4
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      if (workerId === "owner") {
        const selectedOtherDays = companyDoc.ownerData.noConstantWorkingHours.filter(
          (item) => item.fullDate !== newDate.fullDate
        );
        companyDoc.ownerData.noConstantWorkingHours = selectedOtherDays;
      } else {
        const selectedWorkerIndex = companyDoc.workers.findIndex(
          (item) => item._id == workerId
        );
        if (selectedWorkerIndex >= 0) {
          const selectedOtherDays = companyDoc.workers[
            selectedWorkerIndex
          ].noConstantWorkingHours.filter(
            (item) => item.fullDate !== newDate.fullDate
          );
          companyDoc.workers[
            selectedWorkerIndex
          ].noConstantWorkingHours = selectedOtherDays;
          return companyDoc.save();
        }
      }

      return companyDoc;
    })
    .then((companyDoc) => {
      if (workerId === "owner") {
        companyDoc.ownerData.noConstantWorkingHours.push(newDate);
        return companyDoc.save();
      } else {
        const selectedWorkerIndex = companyDoc.workers.findIndex(
          (item) => item._id == workerId
        );

        if (selectedWorkerIndex >= 0) {
          companyDoc.workers[selectedWorkerIndex].noConstantWorkingHours.push(
            newDate
          );
          return companyDoc.save();
        } else {
          const error = new Error("Brak podanego pracownika");
          error.statusCode = 422;
          throw error;
        }
      }
    })
    .then((companySaved) => {
      if (workerId === "owner") {
        const newItemOwner = companySaved.ownerData.noConstantWorkingHours.find(
          (item) => {
            return (
              new Date(item.start).getTime() ===
              new Date(newDate.start).getTime()
            );
          }
        );
        if (!!newItemOwner) {
          res.status(201).json({
            noConstantDay: newItemOwner,
          });
        } else {
          const error = new Error(
            "Błąd podczas pobierania zapisanego dnia pracownika"
          );
          error.statusCode = 422;
          throw error;
        }
      } else {
        const selectedWorkerIndex = companySaved.workers.findIndex(
          (item) => item._id == workerId
        );
        if (selectedWorkerIndex >= 0) {
          const newItem = companySaved.workers[
            selectedWorkerIndex
          ].noConstantWorkingHours.find((item) => {
            return (
              new Date(item.start).getTime() ===
              new Date(newDate.start).getTime()
            );
          });
          if (!!newItem) {
            res.status(201).json({
              noConstantDay: newItem,
            });
          } else {
            const error = new Error(
              "Błąd podczas pobierania zapisanego dnia pracownika"
            );
            error.statusCode = 422;
            throw error;
          }
        } else {
          const error = new Error(
            "Błąd podczas pobierania zapisanego dnia pracownika"
          );
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

exports.companyWorkersDeleteNoConstData = (req, res, next) => {
  const userId = req.userId;
  const workerId = req.body.workerId;
  const companyId = req.body.companyId;
  const noConstDateId = req.body.noConstDateId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers owner ownerData.noConstantWorkingHours")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 4
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      if (workerId === "owner") {
        const selectedOtherDays = companyDoc.ownerData.noConstantWorkingHours.filter(
          (item) => item._id != noConstDateId
        );
        companyDoc.ownerData.noConstantWorkingHours = selectedOtherDays;
        return companyDoc.save();
      } else {
        const selectedWorkerIndex = companyDoc.workers.findIndex(
          (item) => item._id == workerId
        );
        if (selectedWorkerIndex >= 0) {
          const selectedOtherDays = companyDoc.workers[
            selectedWorkerIndex
          ].noConstantWorkingHours.filter((item) => item._id != noConstDateId);
          companyDoc.workers[
            selectedWorkerIndex
          ].noConstantWorkingHours = selectedOtherDays;
          return companyDoc.save();
        } else {
          return companyDoc;
        }
      }
    })

    .then(() => {
      res.status(201).json({
        message: "Pomyślnie usunięto dzień pracy pracownika",
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

exports.companyTekstsUpdate = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const allTextsCompany = req.body.allTextsCompany;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner title reserationText")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      if (!!allTextsCompany.textAboutUs) {
        companyDoc.title = allTextsCompany.textAboutUs;
      }
      if (!!allTextsCompany.textReserwation) {
        companyDoc.reserationText = allTextsCompany.textReserwation;
      }

      if (!!allTextsCompany.links) {
        if (!!allTextsCompany.links.facebook) {
          companyDoc.linkFacebook = allTextsCompany.links.facebook;
        }

        if (!!allTextsCompany.links.instagram) {
          companyDoc.linkInstagram = allTextsCompany.links.instagram;
        }

        if (!!allTextsCompany.links.website) {
          companyDoc.linkiWebsite = allTextsCompany.links.website;
        }
      }

      return companyDoc.save();
    })

    .then(() => {
      res.status(201).json({
        message: "Pomyślnie zaktualizowano tekst",
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

exports.companyOpeningHoursUpdate = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const openingHoursCompany = req.body.openingHoursCompany;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner openingDays daysOff")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      if (!!openingHoursCompany.openingHours) {
        openingHoursCompany.openingHours.forEach((item) => {
          companyDoc.openingDays[item.dayMonth].disabled = item.disabled;
          companyDoc.openingDays[item.dayMonth].start = item.start;
          companyDoc.openingDays[item.dayMonth].end = item.end;
        });
      }
      if (!!openingHoursCompany.daysOff) {
        if (!!openingHoursCompany.daysOff.deletedDayOff) {
          const filterDAysOff = companyDoc.daysOff.filter((item) => {
            const isInDeleted = openingHoursCompany.daysOff.deletedDayOff.some(
              (itemDayOff) => {
                return itemDayOff == item._id;
              }
            );
            return !isInDeleted;
          });
          companyDoc.daysOff = filterDAysOff;
        }

        if (!!openingHoursCompany.daysOff.createdDayOff) {
          openingHoursCompany.daysOff.createdDayOff.forEach((itemCreated) => {
            const newDayOff = {
              day: itemCreated.day,
              month: itemCreated.month,
              year: itemCreated.year,
            };
            companyDoc.daysOff.push(newDayOff);
          });
        }
      }
      return companyDoc.save();
    })

    .then(() => {
      res.status(201).json({
        message: "Pomyślnie zaktualizowano godziny otwarcia",
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

exports.companyMapsUpdate = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const maps = req.body.maps;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner maps")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      companyDoc.maps.lat = maps.lat;
      companyDoc.maps.long = maps.long;
      return companyDoc.save();
    })

    .then(() => {
      res.status(201).json({
        message: "Pomyślnie zaktualizowano mapę",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas aktualizacji mapy.";
      }
      next(err);
    });
};

exports.companyAddConstDateHappyHour = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const constDate = req.body.constDate;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers.permissions workers.user owner happyHoursConst")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 3
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      companyDoc.happyHoursConst.push({
        disabled: constDate.disabled,
        dayWeekIndex: constDate.dayWeekIndex,
        start: constDate.start,
        end: constDate.end,
        promotionPercent: constDate.promotionPercent,
        servicesInPromotion: constDate.servicesInPromotion,
      });
      return companyDoc.save();
    })
    .then((saveItems) => {
      res.status(201).json({
        happyHoursConst: saveItems.happyHoursConst,
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

exports.companyDeleteConstDateHappyHour = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const happyHourId = req.body.happyHourId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers.permissions workers.user owner happyHoursConst")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 3
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      const filterHappyHours = companyDoc.happyHoursConst.filter(
        (item) => item._id != happyHourId
      );
      companyDoc.happyHoursConst = filterHappyHours;
      return companyDoc.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Usunięto happy hour",
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

exports.companyUpdateConstDateHappyHour = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const constDate = req.body.constDate;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers.permissions workers.user owner happyHoursConst")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 3
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      const findIndexHappyHour = companyDoc.happyHoursConst.findIndex(
        (item) => item._id == constDate._id
      );
      if (findIndexHappyHour >= 0) {
        companyDoc.happyHoursConst[findIndexHappyHour].disabled =
          constDate.disabled;
        companyDoc.happyHoursConst[findIndexHappyHour].dayWeekIndex =
          constDate.dayWeekIndex;
        companyDoc.happyHoursConst[findIndexHappyHour].start = constDate.start;
        companyDoc.happyHoursConst[findIndexHappyHour].end = constDate.end;
        companyDoc.happyHoursConst[findIndexHappyHour].promotionPercent =
          constDate.promotionPercent;
        companyDoc.happyHoursConst[findIndexHappyHour].servicesInPromotion =
          constDate.servicesInPromotion;
      }
      return companyDoc.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Zaktualizowano happy hour",
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

exports.companyAddPromotion = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const promotionDate = req.body.promotionDate;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers.permissions workers.user owner promotions")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 3
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      companyDoc.promotions.push({
        disabled: promotionDate.disabled,
        start: promotionDate.start,
        end: promotionDate.end,
        promotionPercent: promotionDate.promotionPercent,
        servicesInPromotion: promotionDate.servicesInPromotion,
      });
      return companyDoc.save();
    })
    .then((saveItems) => {
      res.status(201).json({
        promotions: saveItems.promotions,
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

exports.companyDeletePromotion = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const promotionId = req.body.promotionId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers.permissions workers.user owner promotions")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 3
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      const filterPromotions = companyDoc.promotions.filter(
        (item) => item._id != promotionId
      );
      companyDoc.promotions = filterPromotions;
      return companyDoc.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Usunięto promocję",
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

exports.companyUpdatePromotion = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const promotionDate = req.body.promotionDate;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id workers.permissions workers.user owner promotions")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 3
            );
          }
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      const findIndexHappyHour = companyDoc.promotions.findIndex(
        (item) => item._id == promotionDate._id
      );
      if (findIndexHappyHour >= 0) {
        companyDoc.promotions[findIndexHappyHour].disabled =
          promotionDate.disabled;
        companyDoc.promotions[findIndexHappyHour].dayWeekIndex =
          promotionDate.dayWeekIndex;
        companyDoc.promotions[findIndexHappyHour].start = promotionDate.start;
        companyDoc.promotions[findIndexHappyHour].end = promotionDate.end;
        companyDoc.promotions[findIndexHappyHour].promotionPercent =
          promotionDate.promotionPercent;
        companyDoc.promotions[findIndexHappyHour].servicesInPromotion =
          promotionDate.servicesInPromotion;
      }
      return companyDoc.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Zaktualizowano promocję",
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

exports.companyUploadImage = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const image = req.body.image;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      return getImageUrl("companyImages", image).then((result) => {
        return result;
      });
    })
    .then((imageUrl) => {
      return Company.findOne({
        _id: companyId,
      })
        .select("_id imagesUrl")
        .then((resultCompany) => {
          if (!!resultCompany.imagesUrl) {
            if (resultCompany.imagesUrl.length === 0) {
              resultCompany.mainImageUrl = imageUrl;
            }
          }
          resultCompany.imagesUrl.push(imageUrl);
          resultCompany.save();
          return imageUrl;
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych.";
          }
          next(err);
        });
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

exports.companyDeleteImage = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const imagePath = req.body.imagePath;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then(() => {
      return s3Bucket.deleteObject(
        {
          Bucket: AWS_BUCKET,
          Key: imagePath,
        },
        function (err, data) {
          if (err) {
            res.status(500).send(error);
          } else {
            return true;
          }
        }
      );
    })
    .then(() => {
      return Company.findOne({
        _id: companyId,
      })
        .select("_id imagesUrl mainImageUrl")
        .then((resultCompany) => {
          const filterImages = resultCompany.imagesUrl.filter(
            (item) => item !== imagePath
          );
          const isMainImage = resultCompany.mainImageUrl === imagePath;
          if (isMainImage) {
            resultCompany.mainImageUrl = "";
          }
          resultCompany.imagesUrl = filterImages;
          return resultCompany.save();
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych.";
          }
          next(err);
        });
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

exports.companyMainImage = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const imagePath = req.body.imagePath;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner mainImageUrl")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      resultCompanyDoc.mainImageUrl = imagePath;
      return resultCompanyDoc.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Ustawiono nowe główne zdjęcie",
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

exports.companyOwnerWorkingHours = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const year = req.body.year;
  const month = req.body.month;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(companyId),
        owner: mongoose.Types.ObjectId(userId),
      },
    },
    { $unwind: "$ownerData" },
    {
      $project: {
        _id: 1,
        owner: 1,
        daysOff: 1,
        openingDays: 1,
        reservationEveryTime: 1,
        ownerData: {
          permissions: 1,
          constantWorkingHours: 1,
          noConstantWorkingHours: {
            $filter: {
              input: "$ownerData.noConstantWorkingHours",
              as: "itemOwner",
              cond: {
                $and: [
                  { $eq: ["$$itemOwner.month", month] },
                  { $eq: ["$$itemOwner.year", year] },
                ],
              },
            },
          },
        },
      },
    },
  ])
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc[0].owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      res.status(201).json({
        noConstWorkingHours:
          resultCompanyDoc[0].ownerData.noConstantWorkingHours,
        constWorkingHours: resultCompanyDoc[0].ownerData.constantWorkingHours,
        daysOff: resultCompanyDoc[0].daysOff,
        openingDays: !!resultCompanyDoc[0].openingDays
          ? resultCompanyDoc[0].openingDays
          : null,
        reservationEveryTime: resultCompanyDoc[0].reservationEveryTime,
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

exports.companyWorkersWorkingHours = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const year = req.body.year;
  const month = req.body.month;
  const workerId = req.body.workerId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(companyId),
        "workers.user": mongoose.Types.ObjectId(userId),
      },
    },
    { $unwind: "$workers" },
    {
      $project: {
        _id: 1,
        owner: 1,
        daysOff: 1,
        openingDays: 1,
        reservationEveryTime: 1,
        workers: {
          permissions: 1,
          user: 1,
          _id: 1,
          constantWorkingHours: 1,
          noConstantWorkingHours: {
            $filter: {
              input: "$workers.noConstantWorkingHours",
              as: "item",
              cond: {
                $and: [
                  { $eq: ["$$item.month", month] },
                  { $eq: ["$$item.year", year] },
                ],
              },
            },
          },
        },
      },
    },
  ])
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc[0].owner == userId;
        if (!hasPermission) {
          hasPermission = resultCompanyDoc[0].workers.user == userId;
        }
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      res.status(201).json({
        noConstWorkingHours: resultCompanyDoc[0].workers.noConstantWorkingHours,
        constWorkingHours: resultCompanyDoc[0].workers.constantWorkingHours,
        daysOff: resultCompanyDoc[0].daysOff,
        openingDays: !!resultCompanyDoc[0].openingDays
          ? resultCompanyDoc[0].openingDays
          : null,
        reservationEveryTime: resultCompanyDoc[0].reservationEveryTime,
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

exports.companyAddStamp = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const disabledStamp = req.body.disabledStamp;
  const promotionPercent = req.body.promotionPercent;
  const stampCount = req.body.stampCount;
  const selectedServicesIds = req.body.selectedServicesIds;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner companyStamps")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      resultCompanyDoc.companyStamps.push({
        disabled: disabledStamp,
        promotionPercent: promotionPercent,
        countStampsToActive: stampCount,
        servicesId: selectedServicesIds,
      });
      return resultCompanyDoc.save();
    })
    .then((resultSave) => {
      res.status(201).json({
        newCompanyStamps: resultSave.companyStamps,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas dodawania pieczątki.";
      }
      next(err);
    });
};

exports.companyDeleteStamp = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const stampId = req.body.stampId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner companyStamps")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      const filterStamps = resultCompanyDoc.companyStamps.filter(
        (item) => item._id != stampId
      );
      resultCompanyDoc.companyStamps = filterStamps;
      return resultCompanyDoc.save();
    })
    .then((resultSave) => {
      res.status(201).json({
        newCompanyStamps: resultSave.companyStamps,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas dodawania pieczątki.";
      }
      next(err);
    });
};

exports.companyUpdateStamp = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const disabledStamp = req.body.disabledStamp;
  const promotionPercent = req.body.promotionPercent;
  const stampCount = req.body.stampCount;
  const selectedServicesIds = req.body.selectedServicesIds;
  const stampId = req.body.stampId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner companyStamps")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      const findIndexStamp = resultCompanyDoc.companyStamps.findIndex(
        (item) => item._id == stampId
      );
      if (findIndexStamp >= 0) {
        resultCompanyDoc.companyStamps[findIndexStamp].disabled = disabledStamp;
        resultCompanyDoc.companyStamps[
          findIndexStamp
        ].promotionPercent = promotionPercent;
        resultCompanyDoc.companyStamps[
          findIndexStamp
        ].countStampsToActive = stampCount;
        resultCompanyDoc.companyStamps[
          findIndexStamp
        ].servicesId = selectedServicesIds;
      }

      return resultCompanyDoc.save();
    })
    .then((resultSave) => {
      res.status(201).json({
        newCompanyStamps: resultSave.companyStamps,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas dodawania pieczątki.";
      }
      next(err);
    });
};

exports.companyUpdateShopStore = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const newCategorys = req.body.newCategorys;
  const editedCategory = req.body.editedCategory;
  const deletedCategory = req.body.deletedCategory;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select("_id owner shopStore")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      let allCompanyShopStore = [...resultCompanyDoc.shopStore];

      //new items
      if (newCategorys.length > 0) {
        newCategorys.forEach((category) => {
          const newCategoryData = {
            category: category.category,
            items: [],
          };
          category.items.forEach((item) => {
            const newItem = {
              count: item.count,
              description: item.description,
              disabled: item.disabled,
              name: item.name,
              price: item.price,
            };
            newCategoryData.items.push(newItem);
          });
          allCompanyShopStore.push(newCategoryData);
        });
      }

      //edited items
      if (editedCategory.length > 0) {
        editedCategory.forEach((category) => {
          const findIndexEditedCategory = allCompanyShopStore.findIndex(
            (item) => item._id == category._id
          );
          if (findIndexEditedCategory >= 0) {
            allCompanyShopStore[findIndexEditedCategory].items = [];
            category.items.forEach((item) => {
              const editedItem = {
                count: item.count,
                description: item.description,
                disabled: item.disabled,
                name: item.name,
                price: item.price,
              };
              allCompanyShopStore[findIndexEditedCategory].items.push(
                editedItem
              );
            });
          }
        });
      }

      //deleted items
      if (deletedCategory.length > 0) {
        const filterCompanyShopStore = allCompanyShopStore.filter(
          (itemCompany) => {
            const isInDeleted = deletedCategory.some(
              (itemDeleted) => itemDeleted == itemCompany._id
            );
            return !isInDeleted;
          }
        );
        allCompanyShopStore = filterCompanyShopStore;
      }

      resultCompanyDoc.shopStore = allCompanyShopStore;
      return resultCompanyDoc.save();
    })
    .then((resultSave) => {
      res.status(201).json({
        shopStore: resultSave.shopStore,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas dodawania pieczątki.";
      }
      next(err);
    });
};

exports.companyStatistics = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const months = req.body.months;
  const year = req.body.year;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select(
      "_id owner services.serviceName services._id workers.user workers._id"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        let selectedWorkerId = null;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = true;
            selectedWorkerId = selectedWorker.user;
          }
        }
        if (hasPermission) {
          return {
            resultCompanyDoc: resultCompanyDoc,
            selectedWorkerId: selectedWorkerId,
          };
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
    .then((result) => {
      const findOnlyWorker = !!result.selectedWorkerId
        ? { toWorkerUserId: result.selectedWorkerId }
        : {};
      return Reserwation.find({
        company: companyId,
        ...findOnlyWorker,
        dateYear: year,
        workerReserwation: false,
        dateMonth: { $in: months },
        isDraft: { $in: [false, null] },
      })
        .select(
          "company serviceId dateYear dateMonth dateDay costReserwation visitNotFinished visitCanceled visitChanged activePromotion activeHappyHour activeStamp fullDate toWorkerUserId dateEnd sendSMSCanceled sendSMSNotifaction sendSMSReserwation"
        )
        .populate("toWorkerUserId", "name surname")
        .sort({ fullDate: 1 })
        .then((resultReserwation) => {
          return {
            resultReserwation: resultReserwation,
            services: result.resultCompanyDoc.services,
          };
        });
    })
    .then((resultSave) => {
      res.status(201).json({
        stats: resultSave.resultReserwation,
        services: resultSave.services,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas dodawania pieczątki.";
      }
      next(err);
    });
};

exports.companySentCodeDeleteCompany = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;

  Company.findOne({
    _id: companyId,
  })
    .select("_id name codeDeleteDate codeDelete email owner")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      const randomCode = makeid(10);
      const dateDeleteCompany = new Date(
        new Date().setMinutes(new Date().getMinutes() + 30)
      );
      const hashedCodeToDelete = Buffer.from(randomCode, "utf-8").toString(
        "base64"
      );
      resultCompanyDoc.codeDelete = hashedCodeToDelete;
      resultCompanyDoc.codeDeleteDate = dateDeleteCompany;
      return resultCompanyDoc.save();
    })
    .then((companyData) => {
      const codeToDelete = Buffer.from(
        companyData.codeDelete,
        "base64"
      ).toString("ascii");
      transporter.sendMail({
        to: companyData.email,
        from: MAIL_INFO,
        subject: `Potwierdzenie usunięcia działalności ${companyData.name}`,
        html: `<h1>Kod do usunięcia działalności: ${codeToDelete.toUpperCase()}</h1>`,
      });
      res.status(201).json({
        message: "Wysłano kod do usunięcia działalności",
      });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danej działalności.";
      }
      next(err);
    });
};

exports.companyDeleteCompany = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;
  const code = req.body.code;

  Company.findOne({
    _id: companyId,
  })
    .select(
      "_id name codeDeleteDate codeDelete email owner workers.user workers._id"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      const codeToDelete = Buffer.from(
        resultCompanyDoc.codeDelete,
        "base64"
      ).toString("ascii");
      if (
        codeToDelete.toUpperCase() === code.toUpperCase() &&
        resultCompanyDoc.codeDeleteDate > new Date()
      ) {
        return resultCompanyDoc;
      } else {
        const error = new Error("Nieprawidłowy kod");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((resultCompanyDoc) => {
      const bulkArrayToUpdate = [];

      bulkArrayToUpdate.push({
        updateOne: {
          filter: { _id: resultCompanyDoc.owner },
          update: {
            $set: {
              hasCompany: false,
              company: null,
            },
          },
        },
      });

      resultCompanyDoc.workers.forEach((worker) => {
        bulkArrayToUpdate.push({
          updateOne: {
            filter: { _id: worker.user },
            update: {
              $set: {
                hasCompany: false,
                company: null,
              },
            },
          },
        });

        User.findOne({ _id: worker.user }).then((user) => {
          user.hasCompany = false;
          user.company = null;
          user.save();
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
      return Reserwation.aggregate([
        {
          $match: {
            company: mongoose.Types.ObjectId(companyId),
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
      ])
        .then((allReserwations) => {
          const allUsersReserwations = [];
          const allWorkerReserwations = [];
          const bulkArrayToUpdate = [];
          allReserwations.forEach((item) => {
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
              (reserwation) =>
                reserwation.userId.toString() == item.fromUser._id.toString()
            );

            if (findUserReserwations >= 0) {
              allUsersReserwations[findUserReserwations].items.push(item);
            } else {
              const newUserData = {
                userId: item.fromUser._id,
                items: [item],
              };
              allUsersReserwations.push(newUserData);
            }
            const findWorkerReserwations = allWorkerReserwations.findIndex(
              (reserwation) =>
                reserwation.workerUserId.toString() ==
                item.toWorkerUserId._id.toString()
            );
            if (findWorkerReserwations >= 0) {
              allWorkerReserwations[findWorkerReserwations].items.push(item);
            } else {
              const newUserData = {
                workerUserId: item.toWorkerUserId._id,
                items: [item],
              };
              allWorkerReserwations.push(newUserData);
            }
          });
          return Reserwation.bulkWrite(bulkArrayToUpdate)
            .then(() => {
              return {
                allUsersReserwations: allUsersReserwations,
                allWorkerReserwations: allWorkerReserwations,
              };
            })
            .catch((err) => {
              if (!err.statusCode) {
                err.statusCode = 501;
                err.message = "Błąd podczas aktualizacji rezerwacji.";
              }
              next(err);
            });
        })
        .catch((err) => console.log(err));
    })
    .then(({ allUsersReserwations, allWorkerReserwations }) => {
      const bulkArrayToUpdate = [];
      allUsersReserwations.forEach((userDoc) => {
        const allUserAlertsToSave = [];

        userDoc.items.forEach((itemReserwation) => {
          const userAlertToSave = {
            reserwationId: itemReserwation._id,
            active: true,
            type: "rezerwation_canceled",
            creationTime: new Date(),
            companyChanged: true,
          };

          io.getIO().emit(`user${userDoc.userId}`, {
            action: "update-alerts",
            alertData: {
              reserwationId: itemReserwation,
              active: true,
              type: "rezerwation_canceled",
              creationTime: new Date(),
              companyChanged: true,
            },
          });

          allUserAlertsToSave.push(userAlertToSave);
        });

        bulkArrayToUpdate.push({
          updateOne: {
            filter: {
              _id: userDoc.userId,
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

      allWorkerReserwations.forEach((userDoc) => {
        const allWorkerAlertsToSave = [];

        userDoc.items.forEach((itemReserwation) => {
          const userAlertToSave = {
            reserwationId: itemReserwation._id,
            active: true,
            type: "rezerwation_canceled",
            creationTime: new Date(),
            companyChanged: true,
          };

          io.getIO().emit(`user${userDoc.workerUserId}`, {
            action: "update-alerts",
            alertData: {
              reserwationId: itemReserwation,
              active: true,
              type: "rezerwation_canceled",
              creationTime: new Date(),
              companyChanged: true,
            },
          });

          allWorkerAlertsToSave.push(userAlertToSave);
        });

        bulkArrayToUpdate.push({
          updateOne: {
            filter: {
              _id: userDoc.workerUserId,
            },
            update: {
              $inc: { alertActiveCount: allWorkerAlertsToSave.length },
              $push: {
                alerts: {
                  $each: allWorkerAlertsToSave,
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
      return CompanyUsersInformations.deleteMany({ companyId: companyId });
    })
    .then(() => {
      return CompanyAvailability.deleteOne({ companyId: companyId });
    })
    .then(() => {
      return Company.findOne({ _id: companyId })
        .select("email _id")
        .then((companyData) => {
          if (!!companyData) {
            transporter.sendMail({
              to: companyData.email,
              from: MAIL_INFO,
              subject: `Usunięto działalność!`,
              html: `<h1>Działalność została usunięta</h1>`,
            });
            return true;
          } else {
            const error = new Error("Błąd podczas usuwania działalności.");
            error.statusCode = 423;
            throw error;
          }
        });
    })
    .then(() => {
      return Company.deleteOne({ _id: companyId });
    })

    .then((result) => {
      res.status(201).json({
        message: "Usunięto działalność",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danej działalności.";
      }
      next(err);
    });
};

exports.companyDeleteCreatedCompany = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;

  Company.findOne({
    _id: companyId,
    accountVerified: false,
  })
    .select("_id name email owner workers.user workers._id")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((resultCompanyDoc) => {
      User.findOne({ _id: resultCompanyDoc.owner }).then((user) => {
        user.hasCompany = false;
        user.company = null;
        user.save();
      });
      resultCompanyDoc.workers.forEach((worker) => {
        User.findOne({ _id: worker.user }).then((user) => {
          user.hasCompany = false;
          user.company = null;
          user.save();
        });
      });
    })
    .then(() => {
      return CompanyUsersInformations.deleteMany({ companyId: companyId });
    })
    .then(() => {
      return CompanyAvailability.deleteOne({ companyId: companyId });
    })
    .then(() => {
      return Company.findOne({ _id: companyId })
        .select("email _id")
        .then((companyData) => {
          if (!!companyData) {
            transporter.sendMail({
              to: companyData.email,
              from: MAIL_INFO,
              subject: `Usunięto działalność!`,
              html: `<h1>Działalność została usunięta</h1>`,
            });
            return true;
          } else {
            const error = new Error("Błąd podczas usuwania działalności.");
            error.statusCode = 423;
            throw error;
          }
        });
    })
    .then(() => {
      return Company.deleteOne({ _id: companyId });
    })

    .then((result) => {
      res.status(201).json({
        message: "Usunięto działalność",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danej działalności.";
      }
      next(err);
    });
};

exports.companyTransakcjonHistory = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;

  Company.findOne({
    _id: companyId,
  })
    .select("_id payments owner")
    .populate("payments.coinsId", "-userCreated")
    .populate("payments.invoiceId", "")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyData) => {
      res.status(201).json({
        companyPayments: companyData.payments,
      });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danej działalności.";
      }
      next(err);
    });
};

exports.companySMSUpdate = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const smsReserwationAvaible = req.body.smsReserwationAvaible;
  const smsNotifactionAvaible = req.body.smsNotifactionAvaible;
  const smsCanceledAvaible = req.body.smsCanceledAvaible;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne({
    _id: companyId,
  })
    .select(
      "_id owner smsReserwationAvaible smsNotifactionAvaible smsCanceledAvaible"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return resultCompanyDoc;
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
    .then((companyDoc) => {
      companyDoc.smsReserwationAvaible = smsReserwationAvaible;
      companyDoc.smsNotifactionAvaible = smsNotifactionAvaible;
      companyDoc.smsCanceledAvaible = smsCanceledAvaible;
      return companyDoc.save();
    })

    .then(() => {
      res.status(201).json({
        message: "Pomyślnie zaktualizowano ustawienia sms",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas aktualizacji ustawień sms.";
      }
      next(err);
    });
};
