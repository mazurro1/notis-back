const Company = require("../models/company");
const mongoose = require("mongoose");
const User = require("../models/user");
// const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator/check");
// const jwt = require("jsonwebtoken");
// const io = require("../socket");
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

exports.registrationCompany = (req, res, next) => {
  const companyEmail = req.body.companyEmail;
  const companyName = req.body.companyName;
  const companyNumber = req.body.companyNumber;
  const companyCity = req.body.companyCity;
  const companyDiscrict = req.body.companyDiscrict;
  const companyAdress = req.body.companyAdress;
  const companyIndustries = req.body.companyIndustries;
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
            "-name -phone -adress -owner -workers -reservations -messages -messangerPageId -messangerAppId -messangerHtmlRef -reports"
          )
          .then((companyDoc) => {
            if (!companyDoc) {
              const codeToVerified = Math.floor(
                10000 + Math.random() * 90000
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

              const pathCompanyName = companyName
                .toLowerCase()
                .split(" ")
                .join("-");

              const company = new Company({
                linkPath: pathCompanyName,
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
              });

              return company.save();
            } else {
              const error = new Error("Email zajęty.");
              error.statusCode = 500;
              throw error;
            }
          })
          .then((result) => {
            const unhashedCodeToVerified = Buffer.from(
              result.codeToVerified,
              "base64"
            ).toString("ascii");
            transporter.sendMail({
              to: result.email,
              from: "nootis.help@gmail.com",
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
        from: "nootis.help@gmail.com",
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
    .select("-codeToVerified -raports -codeToActive")
    .populate("owner", "name surname")
    .populate("workers.user", "name surname email")
    .then((companyDoc) => {
      if (companyDoc) {        
        let userHasPermission = userId == companyDoc.owner._id;
        if (!!!userHasPermission) {
          const workerSelected = companyDoc.workers.find(
            (worker) => worker.user._id == userId
          );
          if(!!workerSelected){
            const workerHasAccess = workerSelected.permissions.some(
              (perm) => perm === 2 || perm === 3 || perm === 4
            );
            if(workerHasAccess){
              userHasPermission = true;
            }
          }
        }
        if (!!userHasPermission){
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

          const mapedWorkers = [];
          dataCompany.workers.forEach((item) => {
            const unhashedName = Buffer.from(item.user.name, "base64").toString(
              "ascii"
            );
            const unhashedSurname = Buffer.from(
              item.user.surname,
              "base64"
            ).toString("ascii");
            const unhashedUserProps = {
              email: item.email,
              name: unhashedName,
              surname: unhashedSurname,
              _id: item.user._id,
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
              noConstantWorkingHours: item.noConstantWorkingHours
                ? item.noConstantWorkingHours
                : [],

              servicesCategory: item.servicesCategory
                ? item.servicesCategory
                : [],
            });
          });

          const dataToSent = {
            ownerData: dataCompany.ownerData,
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
            },
            pauseCompany: dataCompany.pauseCompany,
            messangerAvaible: dataCompany.messangerAvaible,
            title: dataCompany.title,
            reservationEveryTime: dataCompany.reservationEveryTime,
            workers: mapedWorkers,
            opinions: dataCompany.opinions,
            messages: dataCompany.messages,
            reports: dataCompany.reports,
            linkFacebook: dataCompany.linkFacebook,
            linkInstagram: dataCompany.linkInstagram,
            linkiWebsite: dataCompany.linkiWebsite,
            reserationText: dataCompany.reserationText,
            daysOff: dataCompany.daysOff,
            reservationMonthTime: dataCompany.reservationMonthTime,
            services: dataCompany.services,
            companyType: dataCompany.companyType,
          };

          res.status(201).json({
            companyProfil: dataToSent,
          });
        }else{
          const error = new Error("Brak uprawnień.");
          error.statusCode = 401;
          throw error;
        }
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
        const randomValue = Math.floor(
          1000000 + Math.random() * 9000000
        ).toString();

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
                from: "nootis.help@gmail.com",
                subject: `Potwierdzenie dodania do listy pracowników w firmie ${result.name}`,
                html: `<h1>Kliknij link aby potwierdzić</h1> <a href="http://www.localhost:8000/confirm-added-worker-to-company/${result._id}/${hashedEmail}/${hashedRandomValue}">kliknij tutaj</a>`,
                // html: `<h1>Kliknij link aby potwierdzić</h1> <a href="http://www.localhost:3000/confirm-added-worker-to-company/${result._id}/${hashedEmail}/${randomValue}">kliknij tutaj</a>`,
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
            console.log(`http://www.localhost:8000/confirm-added-worker-to-company/${companyData._id}/${hashedEmail}/${thisWorker.codeToActive}`)
          transporter.sendMail({
            to: emailWorker,
            from: "nootis.help@gmail.com",
            subject: `Potwierdzenie dodania do listy pracowników w firmie ${companyData.name}`,
            html: `<h1>Kliknij link aby potwierdzić</h1> <a href="http://www.localhost:8000/confirm-added-worker-to-company/${companyData._id}/${hashedEmail}/${thisWorker.codeToActive}">kliknij tutaj</a>`,
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
      if (companyDoc) {
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
  const companyId = req.body.companyId;
  const workerEmail = req.body.workerEmail;
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
    .then((companyDoc) => {
      const allWorkers = companyDoc.workers.filter((worker) => {
        return worker.email !== workerEmail;
      });
      companyDoc.workers = allWorkers;
      return companyDoc.save();
    })
    .then(() => {
      User.findOne({
        email: workerEmail,
      }).then((userDoc) => {
        userDoc.hasCompany = false;
        userDoc.company = null;
        return userDoc.save();
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

exports.updateCompanyProfil = (req, res, next) => {
  const companyId = req.body.companyId;
  const textAboutUs = req.body.textAboutUs;
  const textRezerwation = req.body.textRezerwation;
  const ownerSpecialization = req.body.ownerSpecialization;
  const editedWorkers = req.body.editedWorkers;
  const editedAdress = req.body.editedAdress;
  const editedLinks = req.body.editedLinks;
  const openingHours = req.body.openingHours;
  const companyPaused = req.body.companyPaused;
  const services = req.body.services;
  const reservationEveryTime = req.body.reservationEveryTime;
  const ownerSerwiceCategory = req.body.ownerSerwiceCategory;
  const editedWorkersHours = req.body.editedWorkersHours;
  const userSentId = req.userId;
  const deletedDayOff = req.body.deletedDayOff;
  const createdDayOff = req.body.createdDayOff;
  const reservationMonthTime = req.body.reservationMonthTime;
  const newIndustries = req.body.newIndustries;
  const deletedIndustries = req.body.deletedIndustries;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId
  })
    .select(
      "title name pauseCompany reserationText ownerData city district adress phone linkFacebook linkInstagram linkiWebsite openingDays workers services owner daysOff reservationMonthTime companyType"
    )
    .then((companyDoc) => {
      if(!!companyDoc){
        let userHasPermission = userSentId == companyDoc.owner._id;
        if (!!!userHasPermission) {
          const workerSelected = companyDoc.workers.find(
            (worker) => worker.user._id == userSentId
          );
          if (!!workerSelected) {
            const workerHasAccess = workerSelected.permissions.some(
              (perm) => perm === 2 || perm === 3 || perm === 4
            );
            if (workerHasAccess) {
              userHasPermission = true;
            }
          }
        }
        if (userHasPermission){
            if (!!ownerSerwiceCategory) {
              companyDoc.ownerData.servicesCategory = ownerSerwiceCategory;
            }
            if (!!reservationMonthTime) {
              companyDoc.reservationMonthTime = reservationMonthTime;
            }
            if (!!reservationEveryTime) {
              companyDoc.reservationEveryTime = reservationEveryTime;
            }

            if (!!textAboutUs) {
              companyDoc.title = textAboutUs;
            }

            if (companyPaused !== null) {
              companyDoc.pauseCompany = companyPaused;
            }
            if (!!textRezerwation) {
              companyDoc.reserationText = textRezerwation;
            }

            if (!!ownerSpecialization) {
              companyDoc.ownerData.specialization = ownerSpecialization;
            }

            if (!!deletedIndustries) {
              const filterCompanyIndustries = [
                ...companyDoc.companyType,
              ].filter((companyIndustries) => {
                const isInDeleted = deletedIndustries.some(
                  (itemDeleted) => itemDeleted === companyIndustries
                );
                return !isInDeleted;
              });
              companyDoc.companyType = filterCompanyIndustries;
            }

            if (!!newIndustries) {
              newIndustries.forEach((industriesItem) => {
                companyDoc.companyType.push(industriesItem);
              });
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

            if (services.deleted.length > 0) {
              const newArray = companyDoc.services.filter((itemFirst) => {
                const isInArray = services.deleted.some((itemSecond) => {
                  return itemSecond._id == itemFirst._id;
                });
                return !isInArray;
              });
              companyDoc.services = newArray;
            }

            if (!!editedAdress) {
              if (!!editedAdress.companyName) {
                Company.findOne({
                  name: editedAdress.companyName,
                }).then((resultCompanyName) => {
                  if (!!!resultCompanyName) {
                    companyDoc.name = editedAdress.companyName;
                  } else {
                    const error = new Error("Nazwa firmy jest zajęta.");
                    error.statusCode = 403;
                    throw error;
                  }
                });
              }
              if (!!editedAdress.city) {
                companyDoc.city = editedAdress.city;
              }

              if (!!editedAdress.discrict) {
                companyDoc.district = editedAdress.discrict;
              }

              if (!!editedAdress.adress) {
                const hashedAdress = Buffer.from(
                  editedAdress.adress,
                  "utf-8"
                ).toString("base64");
                companyDoc.adress = hashedAdress;
              }

              if (!!editedAdress.phone) {
                const hashedPhoneNumber = Buffer.from(
                  editedAdress.phone,
                  "utf-8"
                ).toString("base64");
                companyDoc.phone = hashedPhoneNumber;
              }
            }

            if (!!editedLinks) {
              if (editedLinks.facebook !== null) {
                companyDoc.linkFacebook = editedLinks.facebook;
              }

              if (editedLinks.instagram !== null) {
                companyDoc.linkInstagram = editedLinks.instagram;
              }

              if (editedLinks.website !== null) {
                companyDoc.linkiWebsite = editedLinks.website;
              }
            }
            if (openingHours) {
              openingHours.forEach((item) => {
                companyDoc.openingDays[item.dayMonth].disabled = item.disabled;
                companyDoc.openingDays[item.dayMonth].start = item.start;
                companyDoc.openingDays[item.dayMonth].end = item.end;
              });
            }
            if (!!deletedDayOff) {
              const filterDAysOff = companyDoc.daysOff.filter((item) => {
                const isInDeleted = deletedDayOff.some((itemDayOff) => {
                  return itemDayOff == item._id;
                });
                return !isInDeleted;
              });
              companyDoc.daysOff = filterDAysOff;
            }

            if (!!createdDayOff) {
              createdDayOff.forEach((itemCreated) => {
                const newDayOff = {
                  day: itemCreated.day,
                  month: itemCreated.month,
                  year: itemCreated.year,
                };
                companyDoc.daysOff.push(newDayOff);
              });
            }
            if (!!editedWorkers) {
              editedWorkers.forEach((workerEdited) => {
                companyDoc.workers.forEach((worker, index) => {
                  if (worker._id == workerEdited.indexWorker) {
                    if (!!workerEdited.specializationText) {
                      companyDoc.workers[index].specialization =
                        workerEdited.specializationText;
                    }
                    if (!!workerEdited.servicesCategory) {
                      companyDoc.workers[index].servicesCategory =
                        workerEdited.servicesCategory;
                    }
                    if (!!workerEdited.permissions) {
                      companyDoc.workers[index].permissions =
                        workerEdited.permissions;
                    }
                  }
                });
              });
            }
            if (editedWorkersHours.length > 0) {
              const findOwnerWorkersHours = editedWorkersHours.find(
                (itemHours) => itemHours.indexWorker == companyDoc.owner
              );

              if (!!findOwnerWorkersHours) {
                if (findOwnerWorkersHours.constantWorkingHours.length > 0) {
                  findOwnerWorkersHours.constantWorkingHours.forEach(
                    (constDate) => {
                      const dateIsInBackend = companyDoc.ownerData.constantWorkingHours.findIndex(
                        (item) => item.dayOfTheWeek === constDate.dayOfTheWeek
                      );
                      if (dateIsInBackend >= 0) {
                        companyDoc.ownerData.constantWorkingHours[
                          dateIsInBackend
                        ] = constDate;
                      } else {
                        companyDoc.ownerData.constantWorkingHours.push(
                          constDate
                        );
                      }
                    }
                  );
                }
                if (
                  findOwnerWorkersHours.noConstantWorkingHours.deletedEventsIds
                    .length > 0
                ) {
                  const filterCompanyWorkersNoConstDate = companyDoc.ownerData.noConstantWorkingHours.filter(
                    (companyNoConstWorkingHour) => {
                      const isInDeleted = findOwnerWorkersHours.noConstantWorkingHours.deletedEventsIds.some(
                        (itemWorkerEditedDeleted) => {
                          return (
                            itemWorkerEditedDeleted ==
                            companyNoConstWorkingHour._id
                          );
                        }
                      );
                      return !isInDeleted;
                    }
                  );
                  companyDoc.ownerData.noConstantWorkingHours = filterCompanyWorkersNoConstDate;
                }
                if (
                  findOwnerWorkersHours.noConstantWorkingHours.newEvents
                    .length > 0
                ) {
                  findOwnerWorkersHours.noConstantWorkingHours.newEvents.forEach(
                    (noConstDate) => {
                      const newNoConstDateToSave = {
                        fullDate: noConstDate.fullDate,
                        holidays: noConstDate.holidays,
                        start: noConstDate.start,
                        end: noConstDate.end,
                      };
                      companyDoc.ownerData.noConstantWorkingHours.push(
                        newNoConstDateToSave
                      );
                    }
                  );
                }
              }

              const filterWorkerWorkersHours = editedWorkersHours.filter(
                (itemHours) => itemHours.indexWorker != companyDoc.owner
              );
              if (!!filterWorkerWorkersHours) {
                filterWorkerWorkersHours.forEach((workerEdited) => {
                  companyDoc.workers.forEach((worker, index) => {
                    if (worker._id == workerEdited.indexWorker) {
                      if (workerEdited.constantWorkingHours.length > 0) {
                        workerEdited.constantWorkingHours.forEach(
                          (constDate) => {
                            const dateIsInBackend = companyDoc.workers[
                              index
                            ].constantWorkingHours.findIndex(
                              (item) =>
                                item.dayOfTheWeek === constDate.dayOfTheWeek
                            );
                            if (dateIsInBackend >= 0) {
                              companyDoc.workers[index].constantWorkingHours[
                                dateIsInBackend
                              ].dayOfTheWeek = constDate.dayOfTheWeek;
                              companyDoc.workers[index].constantWorkingHours[
                                dateIsInBackend
                              ].startWorking = constDate.startWorking;
                              companyDoc.workers[index].constantWorkingHours[
                                dateIsInBackend
                              ].endWorking = constDate.endWorking;
                              companyDoc.workers[index].constantWorkingHours[
                                dateIsInBackend
                              ].disabled = constDate.disabled;
                            } else {
                              companyDoc.workers[
                                index
                              ].constantWorkingHours.push(constDate);
                            }
                          }
                        );
                      }
                      if (
                        workerEdited.noConstantWorkingHours.deletedEventsIds
                          .length > 0
                      ) {
                        const filterCompanyWorkersNoConstDate = worker.noConstantWorkingHours.filter(
                          (companyNoConstWorkingHour) => {
                            const isInDeleted = workerEdited.noConstantWorkingHours.deletedEventsIds.some(
                              (itemWorkerEditedDeleted) => {
                                return (
                                  itemWorkerEditedDeleted ==
                                  companyNoConstWorkingHour._id
                                );
                              }
                            );
                            return !isInDeleted;
                          }
                        );
                        companyDoc.workers[
                          index
                        ].noConstantWorkingHours = filterCompanyWorkersNoConstDate;
                      }
                      if (
                        workerEdited.noConstantWorkingHours.newEvents.length > 0
                      ) {
                        workerEdited.noConstantWorkingHours.newEvents.forEach(
                          (noConstDate) => {
                            const newNoConstDateToSave = {
                              fullDate: noConstDate.fullDate,
                              holidays: noConstDate.holidays,
                              start: noConstDate.start,
                              end: noConstDate.end,
                            };
                            companyDoc.workers[
                              index
                            ].noConstantWorkingHours.push(newNoConstDateToSave);
                          }
                        );
                      }
                    }
                  });
                });
              }
            }
            return companyDoc.save();
          } else {
            const error = new Error(
              "Brak uprawnień do aktualizacji danych firmowych."
            );
            error.statusCode = 403;
            throw error;
          }
        }else{
           const error = new Error(
             "Brak firmy"
           );
           error.statusCode = 422;
           throw error;
        }
    })
    .then(() => {
      res.status(201).json({
        message: "Zaktualizowano profil firmowy",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas aktualizwoania danych firmy.";
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
      "workers.specialization workers.name adress city district email linkFacebook linkInstagram linkPath linkiWebsite name openingDays owner ownerData pauseCompany phone reserationText services title workers reservationMonthTime usersInformation.isBlocked usersInformation.userId"
    )
    .populate("owner", "name surname")
    .populate("workers.user", "name surname email")
    .then((resultCompanyDoc) => {
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
        const unhashedName = Buffer.from(item.user.name, "base64").toString(
          "ascii"
        );
        const unhashedSurname = Buffer.from(
          item.user.surname,
          "base64"
        ).toString("ascii");
        const unhashedUserProps = {
          email: item.email,
          name: unhashedName,
          surname: unhashedSurname,
          _id: item.user._id,
        };

        return {
          user: unhashedUserProps,
          active: item.active,
          specialization: item.specialization,
          servicesCategory: item.servicesCategory ? item.servicesCategory : [],
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
      };

      // dataCompany.workers = mapedWorkers;
      // dataCompany.adress = unhashedAdress;
      // dataCompany.phone = unhashedPhone;
      // dataCompany.owner.name = unhashedOwnerName;
      // dataCompany.owner.surname = unhashedOwnerSurname;

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
};

exports.allCompanys = (req, res, next) => {
  const page = req.body.page;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.find()
    .select(
      "workers.specialization workers.name adress city district email linkFacebook linkInstagram linkPath linkiWebsite name openingDays owner ownerData pauseCompany phone reserationText services title workers"
    )
    .populate("owner", "name surname")
    .populate("workers.user", "name surname email")
    .skip((page - 1) * 10)
    .limit(10)
    .then((resultCompanyDoc) => {
      if(resultCompanyDoc.length > 0){
      const allCompanysToSent = [];
      resultCompanyDoc.forEach((itemCompany) => {
        const unhashedPhone = Buffer.from(itemCompany.phone, "base64").toString(
          "ascii"
        );

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
          phone: unhashedPhone,
          services: itemCompany.services,
          title: itemCompany.title,
          _id: itemCompany._id,
        };
        allCompanysToSent.push(dataToSent);
      });
      res.status(201).json({
        companysDoc: allCompanysToSent,
      });
    }else {
        const error = new Error(
          "Brak dancyh do pobrania."
        );
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
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.find({ companyType: type })
    .select(
      "workers.specialization workers.name adress city district email linkFacebook linkInstagram linkPath linkiWebsite name openingDays owner ownerData pauseCompany phone reserationText services title workers"
    )
    .populate("owner", "name surname")
    .populate("workers.user", "name surname email")
    .skip((page - 1) * 10)
    .limit(10)
    .then((resultCompanyDoc) => {
      if(resultCompanyDoc.length > 0){
        const allCompanysToSent = [];
        resultCompanyDoc.forEach((itemCompany) => {
          const unhashedPhone = Buffer.from(
            itemCompany.phone,
            "base64"
          ).toString("ascii");

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
            phone: unhashedPhone,
            services: itemCompany.services,
            title: itemCompany.title,
            _id: itemCompany._id,
          };
          allCompanysToSent.push(dataToSent);
        });
        res.status(201).json({
          companysDoc: allCompanysToSent,
        });
      }else {
        const error = new Error(
          "Brak dancyh do pobrania."
        );
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

exports.getCompanyUsersInformations = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({ _id: companyId })
    .select("_id usersInformation workers.permissions workers.user owner")
    .populate("usersInformation.userId", "name surname")
    .populate({
      path: "usersInformation.allUserReserwations.reserwationId",
      select:
        "toWorkerUserId dateDay dateMonth dateYear dateStart dateEnd serviceName",
      populate: {
        path: "toWorkerUserId",
        select: "name surname linkPath",
      },
    })
    .populate(
      "usersInformation.informations.workerWhoWritedUserId",
      "name surname"
    )
    .slice("usersInformation.allUserReserwations", 10)
    .slice("usersInformation.informations", 10)
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        const hasPermission = resultCompanyDoc.owner == userId;
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
          res.status(201).json({
            companysClientInformations: resultCompanyDoc.usersInformation,
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
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.getMoreCompanyUsersInformationsHistory = (req, res, next) => {
  const userId = req.userId;
  const page = req.body.page;
  const userHistoryId = req.body.userHistoryId;
  const companyId = req.body.companyId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne(
    {
      _id: companyId,
      "usersInformation._id": userHistoryId,
    },
    { usersInformation: 1 }
  )
    .slice("usersInformation.allUserReserwations", [10 * page, 10])
    .select("_id usersInformation workers.permissions workers.user owner")
    .populate("usersInformation.userId", "name surname")
    .populate({
      path: "usersInformation.allUserReserwations.reserwationId",
      select:
        "toWorkerUserId dateDay dateMonth dateYear dateStart dateEnd serviceName",
      populate: {
        path: "toWorkerUserId",
        select: "name surname linkPath",
      },
    })
    .populate(
      "usersInformation.informations.workerWhoWritedUserId",
      "name surname"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        const hasPermission = resultCompanyDoc.owner == userId;
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
          res.status(201).json({
            newUserReserwations:
              resultCompanyDoc.usersInformation[0].allUserReserwations,
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
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};



exports.companyUsersInformationsBlock = (req, res, next) => {
  const userId = req.userId;
  const userHistoryId = req.body.userHistoryId;
  const companyId = req.body.companyId;
  const isBlocked = req.body.isBlocked
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  Company.findOne(
    {
      _id: companyId,
      "usersInformation._id": userHistoryId,
    },
    { usersInformation: 1 }
  )
    .select(
      "_id usersInformation._id usersInformation.isBlocked workers.permissions workers.user owner"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        const hasPermission = resultCompanyDoc.owner == userId;
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
            (item) => item._id == userHistoryId
          );
          if (selectUserInformation >= 0) {
            resultCompanyDoc.usersInformation[
              selectUserInformation
            ].isBlocked = isBlocked;
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
    .then(()=>{
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