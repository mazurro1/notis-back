const Company = require("../models/company");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const CompanyAvailability = require("../models/companyAvailability");
const Reserwation = require("../models/reserwation");
const Geolocations = require("../models/geolocation");
const RegisterCompany = require("../models/registerCompany");
const Opinion = require("../models/opinion");
const Report = require("../models/reports");
const Service = require("../models/service");
const Communiting = require("../models/Communiting");
const mongoose = require("mongoose");
const User = require("../models/user");
const Alert = require("../models/alert");
const { validationResult } = require("express-validator");
const AWS = require("aws-sdk");
const getImgBuffer = require("../getImgBuffer");
require("dotenv").config();
const io = require("../socket");
const bcrypt = require("bcryptjs");
const rp = require("request-promise");
const Bir = require("bir1");
const notifications = require("../middleware/notifications");

const {
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  AWS_BUCKET,
  AWS_PATH_URL,
  SITE_FRONT,
  GOOGLE_API_KEY,
  GUS_USER_KEY,
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

const getGUSInfo = async (nipCompany) => {
  const bir = new Bir({ key: GUS_USER_KEY });
  await bir.login();
  const result = await bir.search({ nip: nipCompany });
  return result;
};

function makeid(length) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function convertString(phrase) {
  var maxLength = 100;
  var str = phrase.toLowerCase();
  var charMap = {
    ó: "o",
    ę: "e",
    ą: "a",
    ś: "s",
    ł: "l",
    ż: "z",
    ź: "z",
    ć: "c",
    ń: "n",
  };

  var rx = /(ó|ę|ą|ś|ł|ż|ź|ć|ń)/g;

  // if any non-english charr exists,replace it with proper char
  if (rx.test(str)) {
    str = str.replace(rx, function (m, key, index) {
      return charMap[key];
    });
  }

  // if there are other invalid chars, convert them into blank spaces
  str = str.replace(/[^a-z\d\s-]/gi, "");
  // convert multiple spaces and hyphens into one space
  // str = str.replace(/[\s-]+/g, " ");
  // trim string
  // str.replace(/^\s+|\s+$/g, "");
  // cut string
  str = str.substring(0, str.length <= maxLength ? str.length : maxLength);
  // add hyphens
  // str = str.replace(/\s/g, "-");

  return str;
}

const convertLinkString = (phrase) => {
  const maxLength = 100;
  let str = phrase.toLowerCase();

  const charMapITems = [
    {
      old: "?",
      new: "",
    },
    {
      old: "@",
      new: "",
    },
    {
      old: "#",
      new: "",
    },
    {
      old: "$",
      new: "",
    },
    {
      old: "%",
      new: "",
    },
    {
      old: "^",
      new: "",
    },
    {
      old: "&",
      new: "",
    },
    {
      old: "*",
      new: "",
    },
    {
      old: "(",
      new: "",
    },
    {
      old: ")",
      new: "",
    },
    {
      old: ";",
      new: "",
    },
    {
      old: ":",
      new: "",
    },
    {
      old: "'",
      new: "",
    },
    {
      old: ",",
      new: "",
    },
    {
      old: ".",
      new: "",
    },
    {
      old: "/",
      new: "",
    },
    {
      old: "<",
      new: "",
    },
    {
      old: ">",
      new: "",
    },
    {
      old: "/",
      new: "",
    },
    {
      old: "`",
      new: "",
    },
    {
      old: "!",
      new: "",
    },
    {
      old: "=",
      new: "",
    },
    {
      old: "`",
      new: "",
    },
    {
      old: "ó",
      new: "o",
    },
    {
      old: "ę",
      new: "e",
    },
    {
      old: "ą",
      new: "a",
    },
    {
      old: "ś",
      new: "s",
    },
    {
      old: "ł",
      new: "l",
    },
    {
      old: "ż",
      new: "z",
    },
    {
      old: "ź",
      new: "z",
    },
    {
      old: "ć",
      new: "c",
    },
    {
      old: "ń",
      new: "n",
    },
  ];

  const newArrayString = str.split("");
  const newStr = newArrayString.map((strItem) => {
    const findInAll = charMapITems.find(
      (itemVariable) => itemVariable.old.toLowerCase() === strItem.toLowerCase()
    );
    if (!!findInAll) {
      return findInAll.new;
    } else {
      return strItem;
    }
  });
  const convertedArray = newStr.join("");
  str = convertedArray;
  str = str.replace(/\s/g, "-");
  str = str.substring(0, str.length <= maxLength ? str.length : maxLength);
  return str;
};

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
          .select("_id email")
          .then(async (companyDoc) => {
            if (!!!companyDoc) {
              const companyInfoByNip = await getGUSInfo(companyNip);

              if (!!companyInfoByNip) {
                if (
                  !!companyInfoByNip.nazwa &&
                  !!companyInfoByNip.miejscowosc &&
                  !!companyInfoByNip.kodPocztowy &&
                  !!companyInfoByNip.ulica
                ) {
                  return RegisterCompany.countDocuments({
                    nip: companyNip,
                  }).then((resultFromNip) => {
                    const hashedPhoneNumber = Buffer.from(
                      companyNumber,
                      "utf-8"
                    ).toString("base64");
                    return RegisterCompany.countDocuments({
                      phone: hashedPhoneNumber,
                    }).then((resultFromPhone) => {
                      const maxCountValid =
                        resultFromNip >= resultFromPhone
                          ? resultFromNip
                          : resultFromPhone;
                      const dateCompanyToInvoice = {
                        name: companyInfoByNip.nazwa,
                        city: companyInfoByNip.miejscowosc,
                        postalCode: companyInfoByNip.kodPocztowy,
                        street: `${companyInfoByNip.ulica} ${
                          !!companyInfoByNip.nrNieruchomosci
                            ? companyInfoByNip.nrNieruchomosci
                            : 1
                        }${
                          !!companyInfoByNip.nrLokalu
                            ? `/${companyInfoByNip.nrLokalu}`
                            : ""
                        }`,
                      };
                      const codeToVerified = makeid(6);
                      const codeRandom = Math.floor(
                        1000000 + Math.random() * 9000000
                      ).toString();

                      const hashedCodeToVerified = Buffer.from(
                        codeToVerified,
                        "utf-8"
                      ).toString("base64");

                      const hashedAdress = Buffer.from(
                        companyAdress,
                        "utf-8"
                      ).toString("base64");

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
                      const actualDate = new Date().getDate();
                      const pathCompanyName = encodeURI(
                        convertLinkString(companyName)
                      );
                      const adress = `${companyAdressCode} ${companyCity} ${companyAdress}`;
                      return Geolocations.findOne({
                        adress: convertString(adress.toLowerCase().trim()),
                      })
                        .then((geolocationData) => {
                          if (!!geolocationData) {
                            return {
                              adress: geolocationData.adress,
                              lat: geolocationData.lat,
                              long: geolocationData.long,
                            };
                          } else {
                            const url =
                              "https://maps.googleapis.com/maps/api/geocode/json?address=" +
                              convertString(adress.toLowerCase().trim()) +
                              "&key=" +
                              GOOGLE_API_KEY;

                            return rp(url)
                              .then((resultRp) => {
                                if (!!resultRp) {
                                  const resultReq = JSON.parse(resultRp);
                                  const newgeolocation = new Geolocations({
                                    adress: convertString(
                                      adress.toLowerCase().trim()
                                    ),
                                    lat: resultReq.results[0].geometry.location
                                      .lat,
                                    long: resultReq.results[0].geometry.location
                                      .lng,
                                  });
                                  newgeolocation.save();
                                  return {
                                    adress: adress.toLowerCase().trim(),
                                    lat: resultReq.results[0].geometry.location
                                      .lat,
                                    long: resultReq.results[0].geometry.location
                                      .lng,
                                  };
                                } else {
                                  const error = new Error(
                                    "Błąd podczas pobierania geolokalizacji"
                                  );
                                  error.statusCode = 421;
                                  throw error;
                                }
                              })
                              .catch((err) => {
                                const error = new Error(
                                  "Nie znaleziono danej geolokalizacji"
                                );
                                error.statusCode = 442;
                                throw error;
                              });
                          }
                        })
                        .then((resultGeolocation) => {
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
                            premium: !!maxCountValid
                              ? maxCountValid >= 1 && maxCountValid <= 3
                                ? new Date(new Date().setDate(actualDate + 14))
                                : maxCountValid >= 4 && maxCountValid <= 6
                                ? new Date(new Date().setDate(actualDate + 7))
                                : new Date()
                              : new Date(new Date().setMonth(actualMonth + 3)),
                            smsReserwationAvaible: false,
                            smsReserwationChangedUserAvaible: false,
                            smsNotifactionAvaible: false,
                            smsCanceledAvaible: false,
                            smsChangedAvaible: false,
                            sms: 0,
                            raportSMS: [],
                            maps: {
                              lat: resultGeolocation.lat,
                              long: resultGeolocation.long,
                            },
                            notifactionNoSMS: true,
                            notifactionNoPremium: true,
                            dataToInvoice: dateCompanyToInvoice,
                            dateUpdateNip: new Date(),
                          });

                          const newRegisterCompany = new RegisterCompany({
                            nip: company.nip,
                            phone: company.phone,
                            companyId: company._id,
                          });
                          newRegisterCompany.save();
                          return company.save();
                        })
                        .catch((err) => {
                          if (!err.statusCode) {
                            err.statusCode = 501;
                            err.message =
                              "Błąd podczas pobierania geolokalizacji.";
                          }
                          next(err);
                        });
                    });
                  });
                } else {
                  const error = new Error("Nieprawidłowy numer NIP.");
                  error.statusCode = 443;
                  throw error;
                }
              } else {
                const error = new Error("Nieprawidłowy numer NIP.");
                error.statusCode = 500;
                throw error;
              }
            } else {
              const error = new Error("Email zajęty.");
              error.statusCode = 440;
              throw error;
            }
          })
          .then((result) => {
            return User.updateOne(
              {
                _id: ownerId,
              },
              {
                $set: {
                  company: result._id.toString(),
                },
                $addToSet: {
                  allCompanys: result._id,
                },
              }
            )
              .then(() => {
                return result;
              })
              .catch(() => {
                const error = new Error(
                  "Błąd podczas dodawania admina do firmy."
                );
                error.statusCode = 422;
                throw error;
              });
          })
          .then((result) => {
            const unhashedCodeToVerified = Buffer.from(
              result.codeToVerified,
              "base64"
            ).toString("utf-8");

            notifications.sendEmail({
              email: result.email,
              title: "Tworzenie konta firmowego zakończone powodzeniem",
              defaultText: `Utworzono nowe konto firmowe ${unhashedCodeToVerified}`,
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
      ).toString("utf-8");

      notifications.sendEmail({
        email: companyData.email,
        title: "Tworzenie konta firmowego zakończone powodzeniem",
        defaultText: `Utworzono nowe konto firmowe ${unhashedCodeToVerified}`,
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
        ).toString("utf-8");

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
          .populate({
            path: "serviceId",
            select:
              "workerUserId companyId userId createdAt objectName description",
            populate: {
              path: "workerUserId",
              select: "name surname linkPath",
            },
          })
          .populate({
            path: "communitingId",
            select: "workerUserId companyId userId createdAt description city",
            populate: {
              path: "workerUserId",
              select: "name surname linkPath",
            },
          })
          .limit(10)
          .sort({ createdAt: -1 })
          .then(async (resultOpinions) => {
            const companyOpinions = !!resultOpinions ? resultOpinions : [];
            let userHasPermission = userId == companyDoc.owner._id;
            const userIsAdmin = userId == companyDoc.owner._id;
            const dataGUS = !!userIsAdmin
              ? {
                  dataToInvoice: !!companyDoc.dataToInvoice
                    ? companyDoc.dataToInvoice
                    : null,
                }
              : {};
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
              ).toString("utf-8");

              const unhashedOwnerSurname = Buffer.from(
                companyDoc.owner.surname,
                "base64"
              ).toString("utf-8");

              const unhashedPhone = Buffer.from(
                companyDoc.phone,
                "base64"
              ).toString("utf-8");

              const unhashedAdress = Buffer.from(
                companyDoc.adress,
                "base64"
              ).toString("utf-8");

              let validCompanySMS = 0;
              if (!!companyDoc.sms) {
                validCompanySMS = companyDoc.sms;
              }

              const mapedWorkers = [];
              dataCompany.workers.forEach((item) => {
                const unhashedName = Buffer.from(
                  item.user.name,
                  "base64"
                ).toString("utf-8");
                const unhashedSurname = Buffer.from(
                  item.user.surname,
                  "base64"
                ).toString("utf-8");
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
                sms: validCompanySMS,
                smsReserwationAvaible: !!dataCompany.smsReserwationAvaible
                  ? dataCompany.smsReserwationAvaible
                  : false,
                smsReserwationChangedUserAvaible:
                  !!dataCompany.smsReserwationChangedUserAvaible
                    ? dataCompany.smsReserwationChangedUserAvaible
                    : false,
                smsNotifactionAvaible: !!dataCompany.smsNotifactionAvaible
                  ? dataCompany.smsNotifactionAvaible
                  : false,
                smsCanceledAvaible: !!dataCompany.smsCanceledAvaible
                  ? dataCompany.smsCanceledAvaible
                  : false,
                smsChangedAvaible: !!dataCompany.smsChangedAvaible
                  ? dataCompany.smsChangedAvaible
                  : false,
                smsServiceCreatedAvaible: !!dataCompany.smsServiceCreatedAvaible
                  ? dataCompany.smsServiceCreatedAvaible
                  : false,
                smsServiceChangedAvaible: !!dataCompany.smsServiceChangedAvaible
                  ? dataCompany.smsServiceChangedAvaible
                  : false,
                smsServiceFinishedAvaible:
                  !!dataCompany.smsServiceFinishedAvaible
                    ? dataCompany.smsServiceFinishedAvaible
                    : false,
                smsServiceCanceledAvaible:
                  !!dataCompany.smsServiceCanceledAvaible
                    ? dataCompany.smsServiceCanceledAvaible
                    : false,
                smsServiceDeletedAvaible: !!dataCompany.smsServiceDeletedAvaible
                  ? dataCompany.smsServiceDeletedAvaible
                  : false,
                smsCommunitingNotificationAvaible:
                  !!dataCompany.smsCommunitingNotificationAvaible
                    ? dataCompany.smsCommunitingNotificationAvaible
                    : false,
                smsCommunitingCreatedAvaible:
                  !!dataCompany.smsCommunitingCreatedAvaible
                    ? dataCompany.smsCommunitingCreatedAvaible
                    : false,
                smsCommunitingChangedAvaible:
                  !!dataCompany.smsCommunitingChangedAvaible
                    ? dataCompany.smsCommunitingChangedAvaible
                    : false,
                smsCommunitingCanceledAvaible:
                  !!dataCompany.smsCommunitingCanceledAvaible
                    ? dataCompany.smsCommunitingCanceledAvaible
                    : false,
                smsCommunitingDeletedAvaible:
                  !!dataCompany.smsCommunitingDeletedAvaible
                    ? dataCompany.smsCommunitingDeletedAvaible
                    : false,
                ...dataGUS,
                nip: !!dataCompany.nip ? dataCompany.nip : null,
              };

              res.status(201).json({
                companyProfil: dataToSent,
              });
            } else {
              const error = new Error("Brak uprawnień.");
              error.statusCode = 440;
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
    .select("name workers._id workers.email email owner")
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
                return Company.updateOne(
                  {
                    _id: companyId,
                  },
                  {
                    $addToSet: {
                      workers: newWorker,
                    },
                  }
                )
                  .then(() => {
                    return companyData;
                  })
                  .catch(() => {
                    const error = new Error(
                      "Błąd podczas dodawania użytkownika do firmy."
                    );
                    error.statusCode = 501;
                    throw error;
                  });
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

              notifications.sendEmail({
                email: emailWorker,
                title: `Potwierdzenie dodania do listy pracowników w firmie ${result.name}`,
                defaultText: `Kliknij link aby potwierdzić <a href="${SITE_FRONT}/confirm-added-worker-to-company?${result._id}&${hashedEmail}&${hashedRandomValue}">kliknij tutaj</a>`,
              });

              res.status(201).json({
                message:
                  "Wysłano użytkownikowi wiadomość email do akceptacji zaproszenia do firmy",
              });
            })
            .catch((err) => {
              res.status(422).json({
                message: "Brak użytkwonika",
              });
            });
        } else {
          const error = new Error("Wysłano już email do aktywacji.");
          error.statusCode = 441;
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

          notifications.sendEmail({
            email: emailWorker,
            title: `Potwierdzenie dodania do listy pracowników w firmie ${companyData.name}`,
            defaultText: `Kliknij link aby potwierdzić <a href="${SITE_FRONT}/confirm-added-worker-to-company?${companyData._id}&${hashedEmail}&${thisWorker.codeToActive}">kliknij tutaj</a>`,
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
    "utf-8"
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
    .populate("workers.user", "name surname email")
    .then((companyDoc) => {
      if (!!companyDoc) {
        const unhashedCodeFromClient = Buffer.from(
          codeToActive,
          "base64"
        ).toString("utf-8");

        const selectWorker = companyDoc.workers.find(
          (item) => item.email === unhashedWorkerEmail
        );
        if (!!selectWorker) {
          const unhashedCodeFromBase = Buffer.from(
            selectWorker.codeToActive,
            "base64"
          ).toString("utf-8");
          if (unhashedCodeFromBase === unhashedCodeFromClient) {
            return Company.updateOne(
              {
                _id: companyId,
                "workers.email": unhashedWorkerEmail,
              },
              {
                $set: {
                  "workers.$.active": true,
                  "workers.$.codeToActive": null,
                },
              }
            )
              .then(() => {
                return companyDoc;
              })
              .catch(() => {
                const error = new Error("Błąd podczas dodawania pracownika.");
                error.statusCode = 501;
                throw error;
              });
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
      return User.findOne({
        email: unhashedWorkerEmail,
      })
        .select("email allCompanys")
        .then((userDocUpdate) => {
          if (userDocUpdate) {
            // userDocUpdate.company = result._id;
            userDocUpdate.allCompanys = [
              ...userDocUpdate.allCompanys,
              result._id,
            ];
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
    .then((userDoc) => {
      notifications.sendEmail({
        email: userDoc.email,
        title: `Potwierdzenie dodania do pracy`,
        defaultText: `Dodano do pracy!`,
      });
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
  const password = req.body.password;

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
          return User.findOne({
            _id: companyDoc.owner,
          })
            .select("_id password")
            .then((user) => {
              if (!!user) {
                return bcrypt
                  .compare(password, user.password)
                  .then((doMatch) => {
                    if (doMatch) {
                      return User.findOne({
                        _id: workerUserId,
                      })
                        .select("_id email company allCompanys _id")
                        .then((userWorkerDoc) => {
                          const filterUserCompanys =
                            userWorkerDoc.allCompanys.filter(
                              (itemCompany) => itemCompany != companyId
                            );
                          userWorkerDoc.company = null;
                          userWorkerDoc.allCompanys = filterUserCompanys;

                          notifications.sendEmail({
                            email: userWorkerDoc.email,
                            title: `Usunięto z firmy ${companyDoc.name}`,
                            defaultText: `Konto zostało usunięte z firmy`,
                          });
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
                              return userWorkerDoc.save();
                            })
                            .catch(() => {
                              const error = new Error(
                                "Nie można usunąć pracownika."
                              );
                              error.statusCode = 501;
                              throw error;
                            });
                        })
                        .catch(() => {
                          const error = new Error("Nie znaleziono pracownika.");
                          error.statusCode = 420;
                          throw error;
                        });
                    } else {
                      const error = new Error("Błędne hasło.");
                      error.statusCode = 441;
                      throw error;
                    }
                  });
              }
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
    .then(async (userDoc) => {
      await notifications.updateAllCollection({
        companyId: companyId,
        companyField: "company",
        collection: "Reserwation",
        collectionItems:
          "_id serviceName fromUser toWorkerUserId company isDeleted oldReserwationId hasCommuniting dateYear dateMonth dateDay dateStart dateEnd fullDate costReserwation extraCost extraTime timeReserwation workerReserwation visitNotFinished visitCanceled visitChanged reserwationMessage serviceId activePromotion activeHappyHour activeStamp basicPrice opinionId isDraft sendSMSReserwation sendSMSReserwationUserChanged sendSMSNotifaction sendSMSCanceled sendSMSChanged communitingId",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: { visitCanceled: true },
        filtersCollection: {
          toWorkerUserId: mongoose.Types.ObjectId(userDoc._id),
          company: mongoose.Types.ObjectId(companyId),
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
        },
        smsContent: {
          companySendSMSValidField: "smsCanceledAvaible",
          titleCompanySMSAlert: "sms_canceled_reserwation",
          collectionFieldSMSOnSuccess: {
            sendSMSCanceled: true,
          },
        },
        companyChanged: true,
        typeNotification: "reserwation_canceled",
      });
      return userDoc;
    })
    .then(async (userDoc) => {
      await notifications.updateAllCollection({
        companyId: companyId,
        companyField: "companyId",
        collection: "Service",
        collectionItems:
          "_id objectName description userId companyId month year day createdAt workerUserId",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: { isDeleted: true },
        filtersCollection: {
          workerUserId: userDoc._id,
          companyId: companyId,
          isDeleted: { $in: [false, null] },
          statusValue: { $in: [1, 2] },
        },
        userField: "userId",
        workerField: "workerUserId",
        sendEmailValid: true,
        notificationContent: {
          typeAlert: "serviceId",
        },
        smsContent: {
          companySendSMSValidField: "smsServiceDeletedAvaible",
          titleCompanySMSAlert: "sms_canceled_service",
          collectionFieldSMSOnSuccess: {
            canceledSMS: true,
          },
        },
        companyChanged: true,
        typeNotification: "service_deleted",
      });
      return userDoc;
    })
    .then(async (userDoc) => {
      const resultUpdated = await notifications.updateAllCollection({
        companyId: companyId,
        companyField: "companyId",
        collection: "Communiting",
        collectionItems:
          "_id city description userId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd",
        extraCollectionPhoneField: "phone",
        extraCollectionEmailField: "email",
        extraCollectionNameField: "name surname",
        updateCollectionItemObject: { isDeleted: true },
        filtersCollection: {
          workerUserId: userDoc._id,
          companyId: companyId,
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
        },
        smsContent: {
          companySendSMSValidField: "smsCommunitingCanceledAvaible",
          titleCompanySMSAlert: "sms_canceled_communiting",
          collectionFieldSMSOnSuccess: {
            canceledSMS: true,
          },
        },
        companyChanged: true,
        typeNotification: "commuting_canceled",
      });

      return resultUpdated;
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
      "premium shopStore companyStamps mainImageUrl imagesUrl workers.active workers._id workers.specialization workers.name workers.servicesCategory adress city district email linkFacebook linkInstagram linkPath linkiWebsite name daysOff openingDays owner ownerData pauseCompany phone reserationText services title reservationMonthTime usersInformation.isBlocked usersInformation.userId maps opinionsCount opinionsValue code"
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
          .populate({
            path: "serviceId",
            select:
              "workerUserId companyId userId createdAt objectName description",
            populate: {
              path: "workerUserId",
              select: "name surname linkPath",
            },
          })
          .populate({
            path: "communitingId",
            select: "workerUserId companyId userId createdAt description city",
            populate: {
              path: "workerUserId",
              select: "name surname linkPath",
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
            ).toString("utf-8");

            const unhashedOwnerSurname = Buffer.from(
              resultCompanyDoc.owner.surname,
              "base64"
            ).toString("utf-8");

            const unhashedPhone = Buffer.from(
              resultCompanyDoc.phone,
              "base64"
            ).toString("utf-8");

            const unhashedAdress = Buffer.from(
              resultCompanyDoc.adress,
              "base64"
            ).toString("utf-8");

            const mapedWorkers = dataCompany.workers.map((item) => {
              const unhashedName = Buffer.from(
                item.user.name,
                "base64"
              ).toString("utf-8");
              const unhashedSurname = Buffer.from(
                item.user.surname,
                "base64"
              ).toString("utf-8");
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
  const district = req.body.district;

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

  const districtValid = !!district ? district : null;
  const propsFilterDistrict = !!districtValid
    ? {
        district: {
          $regex: new RegExp(districtValid, "i"),
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
    ...propsFilterDistrict,
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
          ).toString("utf-8");

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
  const district = req.body.district;

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

  const districtValid = !!district ? district : null;
  const propsFilterDistrict = !!districtValid
    ? {
        district: {
          $regex: new RegExp(districtValid, "i"),
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
    ...propsFilterDistrict,
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
          ).toString("utf-8");

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

exports.allMapMarks = (req, res, next) => {
  const type = req.body.type;
  const sorts = req.body.sorts;
  const filters = req.body.filters;
  const localization = req.body.localization;
  const selectedName = req.body.selectedName;
  const district = req.body.district;

  const localizationValid = !!localization ? localization.value : null;
  const localizationValidMaps = !!localization
    ? convertString(localization.value.toLowerCase().trim())
    : "polska";
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

  const districtValid = !!district ? district : null;
  const propsFilterDistrict = !!districtValid
    ? {
        district: {
          $regex: new RegExp(districtValid, "i"),
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
    ...propsFilterDistrict,
    accountVerified: true,
    pauseCompany: false,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .limit(500)
    .select("maps name _id")
    .sort(propsSort)
    .then((resultCompanyDoc) => {
      return Geolocations.findOne({
        adress: localizationValidMaps,
      })
        .then((geolocationData) => {
          if (!!geolocationData) {
            return {
              adress: geolocationData.adress,
              lat: geolocationData.lat,
              long: geolocationData.long,
            };
          } else {
            const url =
              "https://maps.googleapis.com/maps/api/geocode/json?address=" +
              localizationValidMaps +
              "&key=" +
              GOOGLE_API_KEY;

            return rp(url)
              .then((resultRp) => {
                if (!!resultRp) {
                  const resultReq = JSON.parse(resultRp);
                  const newgeolocation = new Geolocations({
                    adress: localizationValidMaps.toLowerCase().trim(),
                    lat: resultReq.results[0].geometry.location.lat,
                    long: resultReq.results[0].geometry.location.lng,
                  });
                  newgeolocation.save();
                  return {
                    adress: localizationValidMaps.toLowerCase().trim(),
                    lat: resultReq.results[0].geometry.location.lat,
                    long: resultReq.results[0].geometry.location.lng,
                  };
                } else {
                  const error = new Error(
                    "Błąd podczas pobierania geolokalizacji"
                  );
                  error.statusCode = 421;
                  throw error;
                }
              })
              .catch((err) => {
                console.log(err);
                const error = new Error(
                  "Błąd podczas pobierania geolokalizacji"
                );
                error.statusCode = 420;
                throw error;
              });
          }
        })
        .then((resultGeolocation) => {
          res.status(201).json({
            mapMarks: resultCompanyDoc,
            geolocation: resultGeolocation,
          });
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania geolokalizacji.";
          }
          next(err);
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
          const selectUserInformation =
            resultCompanyDoc.usersInformation.findIndex(
              (item) => item.userId == selectedUserId
            );
          if (selectUserInformation >= 0) {
            Company.updateOne(
              {
                _id: companyId,
                "usersInformation.userId": selectedUserId,
              },
              {
                $set: {
                  "usersInformation.$.isBlocked": isBlocked,
                },
              }
            ).then(() => {});
          } else {
            resultCompanyDoc.usersInformation.push({
              userId: selectedUserId,
              isBlocked: true,
            });
            return resultCompanyDoc.save();
          }
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
          companyDoc.workers[index].servicesCategory =
            filterWorkerServiceCategory;
        });

        //delete from owner
        const filterOwnerServiceCategory =
          companyDoc.ownerData.servicesCategory.filter((service) => {
            const isServiceInDeleted = services.deleted.some(
              (itemDeletedOwner) => {
                return itemDeletedOwner === service;
              }
            );
            return !isServiceInDeleted;
          });

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
            const filterServiceInHappyHour =
              happyHour.servicesInPromotion.filter((happyHourService) => {
                const isInDeleted = services.deleted.some((serviceDeleted) => {
                  return serviceDeleted == happyHourService;
                });
                return !isInDeleted;
              });
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
            const filterServiceInPromotion =
              promotion.servicesInPromotion.filter((promotionService) => {
                const isInDeleted = services.deleted.some((serviceDeleted) => {
                  return serviceDeleted == promotionService;
                });
                return !isInDeleted;
              });
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
      "_id workers.permissions workers.user owner name adress code city maps nip"
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
      const unhashedAdress = Buffer.from(companyDoc.adress, "base64").toString(
        "utf-8"
      );
      const adressToMap = convertString(
        `${
          !!dataSettings.updateCodeInput
            ? dataSettings.updateCodeInput
            : companyDoc.code
        } ${
          !!dataSettings.updateCityInput
            ? dataSettings.updateCityInput
            : companyDoc.city
        } ${
          !!dataSettings.updateAdressInput
            ? dataSettings.updateAdressInput
            : unhashedAdress
        }`.toLowerCase()
      );

      return Geolocations.findOne({
        adress: adressToMap,
      }).then((geolocationData) => {
        if (!!geolocationData) {
          companyDoc.maps.lat = geolocationData.lat;

          companyDoc.maps.long = geolocationData.long;

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

            RegisterCompany.updateOne(
              {
                companyId: companyDoc._id,
              },
              {
                $set: {
                  phone: hashedPhoneNumber,
                },
              }
            )
              .then(() => {})
              .catch(() => {});
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
            companyDoc.reservationMonthTime =
              dataSettings.reserwationMonthToServer;
          }

          if (!!dataSettings.reserwationEverToServer) {
            companyDoc.reservationEveryTime =
              dataSettings.reserwationEverToServer;
          }

          return companyDoc.save();
        } else {
          const url =
            "https://maps.googleapis.com/maps/api/geocode/json?address=" +
            adressToMap +
            "&key=" +
            GOOGLE_API_KEY;

          return rp(url)
            .then((resultRp) => {
              if (!!resultRp) {
                const resultReq = JSON.parse(resultRp);
                const newgeolocation = new Geolocations({
                  adress: convertString(adressToMap.toLowerCase().trim()),
                  lat: resultReq.results[0].geometry.location.lat,
                  long: resultReq.results[0].geometry.location.lng,
                });
                newgeolocation.save();

                companyDoc.maps.lat =
                  resultReq.results[0].geometry.location.lat;

                companyDoc.maps.long =
                  resultReq.results[0].geometry.location.lng;

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

                  RegisterCompany.updateOne(
                    {
                      companyId: companyDoc._id,
                    },
                    {
                      $set: {
                        phone: hashedPhoneNumber,
                      },
                    }
                  )
                    .then(() => {})
                    .catch(() => {});
                }

                if (!!dataSettings.industriesComponent) {
                  if (
                    dataSettings.industriesComponent != companyDoc.companyType
                  ) {
                    companyDoc.companyType = dataSettings.industriesComponent;
                  }
                }

                if (dataSettings.pauseCompanyToServer !== null) {
                  companyDoc.pauseCompany = dataSettings.pauseCompanyToServer;
                }

                if (!!dataSettings.reserwationMonthToServer) {
                  companyDoc.reservationMonthTime =
                    dataSettings.reserwationMonthToServer;
                }

                if (!!dataSettings.reserwationEverToServer) {
                  companyDoc.reservationEveryTime =
                    dataSettings.reserwationEverToServer;
                }

                return companyDoc.save();
              } else {
                const error = new Error(
                  "Błąd podczas pobierania geolokalizacji"
                );
                error.statusCode = 421;
                throw error;
              }
            })
            .catch((err) => {
              console.log(err);
              const error = new Error("Błąd podczas pobierania geolokalizacji");
              error.statusCode = 420;
              throw error;
            });
        }
      });
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
    .select(
      "_id workers._id workers.user workers.specialization workers.constantWorkingHours workers.servicesCategory workers.permissions owner ownerData.specialization ownerData.constantWorkingHours ownerData.servicesCategory ownerData.permissions"
    )
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find((worker) => {
            return worker.user == userId;
          });
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some((perm) => {
              return perm === 4;
            });
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
              const dateIsInBackend =
                companyDoc.ownerData.constantWorkingHours.findIndex(
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
      },
    },
    {
      $project: {
        _id: 1,
        owner: 1,
        workers: {
          $filter: {
            input: "$workers",
            as: "workerFirstFilter",
            cond: {
              $and: [
                {
                  $eq: [
                    "$$workerFirstFilter._id",
                    mongoose.Types.ObjectId(workerId),
                  ],
                },
              ],
            },
          },
        },
      },
    },
    { $unwind: { path: "$workers", preserveNullAndEmptyArrays: true } },
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
      if (resultCompanyDoc.length > 0) {
        const companyDoc = resultCompanyDoc[0];
        if (!!companyDoc.workers._id) {
          let hasPermission = companyDoc.owner == userId;
          if (!hasPermission) {
            hasPermission = companyDoc.workers.permissions.some(
              (perm) => perm === 4
            );
          }
          if (hasPermission) {
            return {
              workerNoConstHours: companyDoc.workers.noConstantWorkingHours,
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
    .then(({ workerNoConstHours }) => {
      res.status(201).json({
        noConstWorkingHours: workerNoConstHours,
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
  const ownerId = req.body.ownerId;

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
        owner: mongoose.Types.ObjectId(ownerId),
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
      },
    },
  ])
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc[0].owner == ownerId;
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
  const dateStart = new Date(newDate.start);
  const dateEnd = new Date(newDate.start);
  const dayMinus = new Date(dateStart.setDate(dateStart.getDate() - 1));
  const dayPlus = new Date(dateEnd.setDate(dateEnd.getDate() + 1));

  const validIsOwner = workerId === "owner" ? userId : workerId;

  let bulkArrayToUpdate = [];

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
        premium: {
          $gte: new Date(),
        },
      },
    },
    { $unwind: "$ownerData" },
    {
      $project: {
        ownerData: 1,
        workers: {
          $filter: {
            input: "$workers",
            as: "workerFirstFilter",
            cond: {
              $and: [
                {
                  $eq: [
                    "$$workerFirstFilter.user",
                    mongoose.Types.ObjectId(validIsOwner),
                  ],
                },
              ],
            },
          },
        },
        owner: 1,
        premium: 1,
        _id: 1,
      },
    },
    { $unwind: { path: "$workers", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        ownerData: {
          _id: 1,
          user: 1,
          noConstantWorkingHours: {
            $filter: {
              input: "$ownerData.noConstantWorkingHours",
              as: "itemOwner",
              cond: {
                $and: [
                  { $gte: ["$$itemOwner.start", dayMinus] },
                  { $lte: ["$$itemOwner.start", dayPlus] },
                ],
              },
            },
          },
        },
        workers: {
          _id: 1,
          user: 1,
          permissions: 1,
          noConstantWorkingHours: {
            $filter: {
              input: "$workers.noConstantWorkingHours",
              as: "item",
              cond: {
                $and: [
                  { $gte: ["$$item.start", dayMinus] },
                  { $lte: ["$$item.start", dayPlus] },
                ],
              },
            },
          },
        },
        owner: 1,
        premium: 1,
        pauseCompany: 1,
        _id: 1,
      },
    },
  ])
    .then((companyDoc) => {
      if (companyDoc.length > 0) {
        const resultCompanyDoc = companyDoc[0];
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          if (!!resultCompanyDoc.workers.permissions) {
            hasPermission = resultCompanyDoc.workers.permissions.some(
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
        const selectedOtherDaysOwner =
          companyDoc.ownerData.noConstantWorkingHours.find(
            (item) => item.fullDate === newDate.fullDate
          );
        if (!!selectedOtherDaysOwner) {
          bulkArrayToUpdate.push({
            updateOne: {
              filter: {
                _id: companyId,
              },
              update: {
                $pull: {
                  "ownerData.noConstantWorkingHours": {
                    _id: selectedOtherDaysOwner._id,
                  },
                },
              },
            },
          });
        }
      } else {
        if (!!companyDoc.workers._id) {
          const selectedOtherDays =
            companyDoc.workers.noConstantWorkingHours.find(
              (item) => item.fullDate === newDate.fullDate
            );
          if (!!selectedOtherDays) {
            bulkArrayToUpdate.push({
              updateOne: {
                filter: {
                  _id: companyId,
                  "workers._id": companyDoc.workers._id,
                },
                update: {
                  $pull: {
                    "workers.$.noConstantWorkingHours": {
                      _id: selectedOtherDays._id,
                    },
                  },
                },
              },
            });
          }
          return companyDoc;
        }
      }
      return companyDoc;
    })
    .then(() => {
      if (workerId === "owner") {
        bulkArrayToUpdate.push({
          updateOne: {
            filter: {
              _id: companyId,
            },
            update: {
              $addToSet: {
                "ownerData.noConstantWorkingHours": newDate,
              },
            },
          },
        });
      } else {
        bulkArrayToUpdate.push({
          updateOne: {
            filter: {
              _id: companyId,
              "workers.user": workerId,
            },
            update: {
              $addToSet: {
                "workers.$.noConstantWorkingHours": newDate,
              },
            },
          },
        });
      }
      return Company.bulkWrite(bulkArrayToUpdate)
        .then(() => {
          return true;
        })
        .catch((err) => {
          console.log(err);
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas aktualizacji noConstHours.";
          }
          next(err);
        });
    })
    .then(() => {
      return Company.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(companyId),
            premium: {
              $gte: new Date(),
            },
          },
        },
        { $unwind: "$ownerData" },
        {
          $project: {
            ownerData: 1,
            workers: {
              $filter: {
                input: "$workers",
                as: "workerFirstFilter",
                cond: {
                  $and: [
                    {
                      $eq: [
                        "$$workerFirstFilter.user",
                        mongoose.Types.ObjectId(validIsOwner),
                      ],
                    },
                  ],
                },
              },
            },
            owner: 1,
            premium: 1,
            _id: 1,
          },
        },
        { $unwind: { path: "$workers", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            ownerData: {
              _id: 1,
              user: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$ownerData.noConstantWorkingHours",
                  as: "itemOwner",
                  cond: {
                    $and: [{ $eq: ["$$itemOwner.fullDate", newDate.fullDate] }],
                  },
                },
              },
            },
            workers: {
              _id: 1,
              user: 1,
              permissions: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$workers.noConstantWorkingHours",
                  as: "itemWorker",
                  cond: {
                    $and: [
                      { $eq: ["$$itemWorker.fullDate", newDate.fullDate] },
                    ],
                  },
                },
              },
            },
            owner: 1,
            premium: 1,
            pauseCompany: 1,
            _id: 1,
          },
        },
      ]).then((resultSavedNoConst) => {
        const savedNoConst = resultSavedNoConst[0];
        bulkArrayToUpdate = [];
        if (workerId === "owner") {
          const findSelectedNoConstHoursOwner =
            savedNoConst.ownerData.noConstantWorkingHours.find(
              (hour) => hour.fullDate === newDate.fullDate
            );
          res.status(201).json({
            noConstantDay: !!findSelectedNoConstHoursOwner
              ? findSelectedNoConstHoursOwner
              : [],
          });
        } else {
          const findSelectedNoConstHours =
            savedNoConst.workers.noConstantWorkingHours.find(
              (hour) => hour.fullDate === newDate.fullDate
            );
          res.status(201).json({
            noConstantDay: !!findSelectedNoConstHours
              ? findSelectedNoConstHours
              : [],
          });
        }
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
    .select("_id owner workers.permissions")
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
    .then(() => {
      if (workerId === "owner") {
        return Company.updateOne(
          {
            _id: companyId,
          },
          {
            $pull: {
              "ownerData.noConstantWorkingHours": {
                _id: noConstDateId,
              },
            },
          }
        )
          .then(() => {
            res.status(201).json({
              message: "Pomyślnie usunięto dzień pracy pracownika",
            });
          })
          .catch(() => {
            const error = new Error("Błąd podczas dodawania pracownika.");
            error.statusCode = 501;
            throw error;
          });
      } else {
        return Company.updateOne(
          {
            _id: companyId,
            "workers._id": workerId,
          },
          {
            $pull: {
              "workers.$.noConstantWorkingHours": {
                _id: noConstDateId,
              },
            },
          }
        )
          .then(() => {
            res.status(201).json({
              message: "Pomyślnie usunięto dzień pracy pracownika",
            });
          })
          .catch(() => {
            const error = new Error("Błąd podczas dodawania pracownika.");
            error.statusCode = 501;
            throw error;
          });
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
    .select(
      "_id owner title reserationText linkFacebook linkInstagram linkiWebsite"
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
    .then(() => {
      return Company.updateOne(
        {
          _id: companyId,
          "happyHoursConst._id": happyHourId,
        },
        {
          $pull: {
            happyHoursConst: {
              _id: happyHourId,
            },
          },
        }
      )
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
    .then(() => {
      return Company.updateOne(
        {
          _id: companyId,
          "happyHoursConst._id": constDate._id,
        },
        {
          $set: {
            "happyHoursConst.$.disabled": constDate.disabled,
            "happyHoursConst.$.dayWeekIndex": constDate.dayWeekIndex,
            "happyHoursConst.$.start": constDate.start,
            "happyHoursConst.$.end": constDate.end,
            "happyHoursConst.$.promotionPercent": constDate.promotionPercent,
            "happyHoursConst.$.servicesInPromotion":
              constDate.servicesInPromotion,
          },
        }
      )
        .then(() => {
          return true;
        })
        .catch(() => {
          const error = new Error("Błąd podczas aktualizacji happy hours.");
          error.statusCode = 403;
          throw error;
        });
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
    .then(() => {
      return Company.updateOne(
        {
          _id: companyId,
          "promotions._id": promotionId,
        },
        {
          $pull: {
            promotions: {
              _id: promotionId,
            },
          },
        }
      )
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
    .then(() => {
      return Company.updateOne(
        {
          _id: companyId,
          "promotions._id": promotionDate._id,
        },
        {
          $set: {
            "promotions.$.disabled": promotionDate.disabled,
            "promotions.$.dayWeekIndex": promotionDate.dayWeekIndex,
            "promotions.$.start": promotionDate.start,
            "promotions.$.end": promotionDate.end,
            "promotions.$.promotionPercent": promotionDate.promotionPercent,
            "promotions.$.servicesInPromotion":
              promotionDate.servicesInPromotion,
          },
        }
      )
        .then(() => {
          return true;
        })
        .catch(() => {
          const error = new Error("Błąd podczas aktualizacji promocji.");
          error.statusCode = 403;
          throw error;
        });
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
      },
    },
    { $unwind: "$ownerData" },
    {
      $project: {
        ownerData: {
          _id: 1,
          user: 1,
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
        _id: 1,
        owner: 1,
        daysOff: {
          $filter: {
            input: "$daysOff",
            as: "itemDayOff",
            cond: {
              $and: [
                { $eq: ["$$itemDayOff.month", month] },
                { $eq: ["$$itemDayOff.year", year] },
              ],
            },
          },
        },
        openingDays: 1,
        reservationEveryTime: 1,
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
    .then((companyDoc) => {
      if (companyDoc.length > 0) {
        const resultCompanyDoc = companyDoc[0];
        res.status(201).json({
          noConstWorkingHours:
            resultCompanyDoc.ownerData.noConstantWorkingHours,
          constWorkingHours: resultCompanyDoc.ownerData.constantWorkingHours,
          daysOff: resultCompanyDoc.daysOff,
          openingDays: !!resultCompanyDoc.openingDays
            ? resultCompanyDoc.openingDays
            : null,
          reservationEveryTime: resultCompanyDoc.reservationEveryTime,
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
      },
    },
    {
      $project: {
        _id: 1,
        owner: 1,
        daysOff: 1,
        openingDays: 1,
        reservationEveryTime: 1,
        workers: {
          $filter: {
            input: "$workers",
            as: "workerFirstFilter",
            cond: {
              $and: [
                {
                  $eq: [
                    "$$workerFirstFilter.user",
                    mongoose.Types.ObjectId(userId),
                  ],
                },
              ],
            },
          },
        },
      },
    },
    { $unwind: { path: "$workers", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        owner: 1,
        daysOff: {
          $filter: {
            input: "$daysOff",
            as: "itemDayOff",
            cond: {
              $and: [
                { $eq: ["$$itemDayOff.month", month] },
                { $eq: ["$$itemDayOff.year", year] },
              ],
            },
          },
        },
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
    .then((companyDoc) => {
      if (companyDoc.length > 0) {
        const resultCompanyDoc = companyDoc[0];
        res.status(201).json({
          noConstWorkingHours: resultCompanyDoc.workers.noConstantWorkingHours,
          constWorkingHours: resultCompanyDoc.workers.constantWorkingHours,
          daysOff: resultCompanyDoc.daysOff,
          openingDays: !!resultCompanyDoc.openingDays
            ? resultCompanyDoc.openingDays
            : null,
          reservationEveryTime: resultCompanyDoc.reservationEveryTime,
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
    .select(
      "_id owner companyStamps workers._id workers.user workers.permissions"
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
      return Company.updateOne(
        {
          _id: companyId,
        },
        {
          $pull: {
            companyStamps: { _id: stampId },
          },
        }
      )
        .then(() => {
          return true;
        })
        .catch(() => {
          const error = new Error("Błąd podczas usuwania stamp-a.");
          error.statusCode = 501;
          throw error;
        });
    })
    .then(() => {
      res.status(201).json({
        message: "Usunięto stamp",
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
      return Company.updateOne(
        {
          _id: companyId,
          "companyStamps._id": stampId,
        },
        {
          $set: {
            "companyStamps.$.disabled": disabledStamp,
            "companyStamps.$.promotionPercent": promotionPercent,
            "companyStamps.$.countStampsToActive": stampCount,
            "companyStamps.$.servicesId": selectedServicesIds,
          },
        }
      ).then(() => {
        res.status(201).json({
          message: "Zaktualizowano stamp",
        });
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
    .select("_id owner shopStore workers._id workers.user workers.permissions")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (!hasPermission) {
          const selectedWorker = resultCompanyDoc.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 7
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
  Company.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(companyId),
      },
    },
    {
      $project: {
        _id: 1,
        owner: 1,
        services: {
          serviceName: 1,
          _id: 1,
        },
        workers: {
          user: 1,
          _id: 1,
        },
        raportSMS: {
          $filter: {
            input: "$raportSMS",
            as: "raport",
            cond: {
              $and: [
                { $in: ["$$raport.month", months] },
                { $eq: ["$$raport.year", year] },
              ],
            },
          },
        },
      },
    },
  ])
    .then((resultCompanyDocQuery) => {
      const resultCompanyDoc = resultCompanyDocQuery[0];

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

      const findOnlyWorkerSecond = !!result.selectedWorkerId
        ? { workerUserId: result.selectedWorkerId }
        : {};

      return Reserwation.find({
        company: companyId,
        ...findOnlyWorker,
        dateYear: year,
        workerReserwation: false,
        dateMonth: { $in: months },
        isDraft: { $in: [false, null] },
        isDeleted: { $in: [false, null] },
      })
        .select(
          "company serviceId dateYear dateMonth dateDay costReserwation visitNotFinished visitCanceled visitChanged activePromotion activeHappyHour activeStamp fullDate toWorkerUserId dateEnd sendSMSChanged sendSMSCanceled sendSMSNotifaction sendSMSReserwation"
        )
        .populate("toWorkerUserId", "name surname")
        .sort({ fullDate: 1 })
        .then((resultReserwation) => {
          return Service.find({
            companyId: companyId,
            month: { $in: months },
            year: { $eq: year },
            statusValue: { $in: [3, 4] },
            ...findOnlyWorkerSecond,
          })
            .select("companyId cost day month year isDeleted workerUserId")
            .populate("workerUserId", "name surname")
            .then((raportServices) => {
              return Communiting.find({
                companyId: companyId,
                month: { $in: months },
                year: { $eq: year },
                ...findOnlyWorkerSecond,
              })
                .select(
                  "companyId cost day month year isDeleted workerUserId timeEnd statusValue"
                )
                .populate("workerUserId", "name surname")
                .then((raportCommunitings) => {
                  return {
                    resultReserwation: resultReserwation,
                    services: result.resultCompanyDoc.services,
                    raportSMS: result.resultCompanyDoc.raportSMS,
                    raportServices: raportServices,
                    raportCommunitings: raportCommunitings,
                  };
                });
            });
        });
    })
    .then((resultSave) => {
      res.status(201).json({
        stats: resultSave.resultReserwation,
        services: resultSave.services,
        raportSMS: resultSave.raportSMS,
        raportServices: resultSave.raportServices,
        raportCommunitings: resultSave.raportCommunitings,
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
      ).toString("utf-8");

      notifications.sendEmail({
        email: companyData.email,
        title: `Potwierdzenie usunięcia działalności ${companyData.name}`,
        defaultText: `Kod do usunięcia działalności: ${codeToDelete.toUpperCase()}`,
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
      "_id name codeDeleteDate codeDelete email owner workers.user workers._id pauseCompany"
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
      ).toString("utf-8");
      if (
        codeToDelete.toUpperCase() === code.toUpperCase() &&
        resultCompanyDoc.codeDeleteDate > new Date()
      ) {
        resultCompanyDoc.pauseCompany = true;
        return resultCompanyDoc.save();
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
              company: null,
            },
            $pull: {
              allCompanys: companyId,
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
                company: null,
              },
              $pull: {
                allCompanys: companyId,
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
      return Reserwation.find({
        company: mongoose.Types.ObjectId(companyId),
        isDraft: { $in: [false, null] },
        visitNotFinished: false,
        visitCanceled: false,
        fullDate: {
          $gte: new Date().toISOString(),
        },
        isDeleted: { $in: [false, null] },
      })
        .populate("company", "name linkPath _id")
        .populate("fromUser toWorkerUserId", "name surname _id")
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
      return Service.find({
        companyId: companyId,
        isDeleted: { $in: [false, null] },
        statusValue: { $in: [1, 2] },
      })
        .select(
          "_id objectName description userId companyId month year day createdAt workerUserId"
        )
        .populate("userId", "name surname")
        .populate("companyId", "name linkPath")
        .then((workerServices) => {
          const bulkArrayToUpdateUsers = [];
          const bulkArrayToUpdateServices = [];
          for (const workerService of workerServices) {
            bulkArrayToUpdateServices.push({
              updateOne: {
                filter: {
                  _id: workerService._id,
                },
                update: {
                  $set: { isDeleted: true },
                },
              },
            });

            const userAlertToSave = {
              serviceId: workerService._id,
              active: true,
              type: "service_deleted",
              creationTime: new Date(),
              companyChanged: true,
            };

            io.getIO().emit(`user${workerService.workerUserId}`, {
              action: "update-alerts",
              alertData: {
                serviceId: workerService,
                active: true,
                type: "service_deleted",
                creationTime: new Date(),
                companyChanged: true,
              },
            });
            if (!!workerService.userId) {
              io.getIO().emit(`user${workerService.userId._id}`, {
                action: "update-alerts",
                alertData: {
                  serviceId: workerService,
                  active: true,
                  type: "service_deleted",
                  creationTime: new Date(),
                  companyChanged: true,
                },
              });
              bulkArrayToUpdateUsers.push({
                updateOne: {
                  filter: {
                    _id: workerService.userId._id,
                  },
                  update: {
                    $inc: { alertActiveCount: 1 },
                    $push: {
                      alerts: {
                        $each: [userAlertToSave],
                        $position: 0,
                      },
                    },
                  },
                },
              });
            }
            bulkArrayToUpdateUsers.push({
              updateOne: {
                filter: {
                  _id: workerService.workerUserId,
                },
                update: {
                  $inc: { alertActiveCount: 1 },
                  $push: {
                    alerts: {
                      $each: [userAlertToSave],
                      $position: 0,
                    },
                  },
                },
              },
            });
          }
          return Service.bulkWrite(bulkArrayToUpdateServices)
            .then(() => {
              return {
                allUsersReserwations: allUsersReserwations,
                allWorkerReserwations: allWorkerReserwations,
                bulkArrayToUpdateUsers: bulkArrayToUpdateUsers,
              };
            })
            .catch((err) => {
              if (!err.statusCode) {
                err.statusCode = 501;
                err.message = "Błąd podczas wysyłania powiadomień.";
              }
              next(err);
            });
        });
    })
    .then(
      ({
        allUsersReserwations,
        allWorkerReserwations,
        bulkArrayToUpdateUsers,
      }) => {
        return Communiting.find({
          companyId: companyId,
          isDeleted: { $in: [false, null] },
          statusValue: { $in: [1, 2] },
          fullDate: {
            $gte: new Date().toISOString(),
          },
        })
          .select(
            "_id city description userId companyId month year day createdAt workerUserId dateEndValid"
          )
          .populate("companyId userId", "_id name surname linkPath")
          .then((communitingItems) => {
            const bulkArrayToUpdateUsersCommuniting = [
              ...bulkArrayToUpdateUsers,
            ];
            const bulkArrayToUpdate = [];
            for (const communitingItem of communitingItems) {
              bulkArrayToUpdate.push({
                updateOne: {
                  filter: {
                    _id: communitingItem._id,
                  },
                  update: {
                    $set: { isDeleted: true },
                  },
                },
              });

              const userAlertToSave = {
                communitingId: communitingItem._id,
                active: true,
                type: "commuting_deleted",
                creationTime: new Date(),
                companyChanged: true,
              };

              io.getIO().emit(`user${communitingItem.workerUserId}`, {
                action: "update-alerts",
                alertData: {
                  communitingId: communitingItem,
                  active: true,
                  type: "commuting_deleted",
                  creationTime: new Date(),
                  companyChanged: true,
                },
              });
              if (!!communitingItem.userId) {
                io.getIO().emit(`user${communitingItem.userId._id}`, {
                  action: "update-alerts",
                  alertData: {
                    reserwationId: communitingItem,
                    active: true,
                    type: "commuting_deleted",
                    creationTime: new Date(),
                    companyChanged: true,
                  },
                });
                bulkArrayToUpdateUsersCommuniting.push({
                  updateOne: {
                    filter: {
                      _id: communitingItem.userId._id,
                    },
                    update: {
                      $inc: { alertActiveCount: 1 },
                      $push: {
                        alerts: {
                          $each: [userAlertToSave],
                          $position: 0,
                        },
                      },
                    },
                  },
                });
              }
              bulkArrayToUpdateUsersCommuniting.push({
                updateOne: {
                  filter: {
                    _id: communitingItem.workerUserId,
                  },
                  update: {
                    $inc: { alertActiveCount: 1 },
                    $push: {
                      alerts: {
                        $each: [userAlertToSave],
                        $position: 0,
                      },
                    },
                  },
                },
              });
            }

            return Communiting.bulkWrite(bulkArrayToUpdate)
              .then(() => {
                return {
                  allUsersReserwations: allUsersReserwations,
                  allWorkerReserwations: allWorkerReserwations,
                  bulkArrayToUpdateUsers: bulkArrayToUpdateUsersCommuniting,
                };
              })
              .catch((err) => {
                if (!err.statusCode) {
                  err.statusCode = 501;
                  err.message = "Błąd podczas wysyłania powiadomień.";
                }
                next(err);
              });
          });
      }
    )
    .then(
      ({
        allUsersReserwations,
        allWorkerReserwations,
        bulkArrayToUpdateUsers,
      }) => {
        const bulkArrayToUpdate = [...bulkArrayToUpdateUsers];
        allUsersReserwations.forEach((userDoc) => {
          const allUserAlertsToSave = [];
          for (const itemReserwation of userDoc.items) {
            const userAlertToSave = {
              reserwationId: itemReserwation._id,
              active: true,
              type: "reserwation_canceled",
              creationTime: new Date(),
              companyChanged: true,
            };

            io.getIO().emit(`user${userDoc.userId}`, {
              action: "update-alerts",
              alertData: {
                reserwationId: itemReserwation,
                active: true,
                type: "reserwation_canceled",
                creationTime: new Date(),
                companyChanged: true,
              },
            });

            allUserAlertsToSave.push(userAlertToSave);
          }

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

        for (const userDoc of allWorkerReserwations) {
          const allWorkerAlertsToSave = [];

          for (const itemReserwation of userDoc.items) {
            const userAlertToSave = {
              reserwationId: itemReserwation._id,
              active: true,
              type: "reserwation_canceled",
              creationTime: new Date(),
              companyChanged: true,
            };

            io.getIO().emit(`user${userDoc.workerUserId}`, {
              action: "update-alerts",
              alertData: {
                reserwationId: itemReserwation,
                active: true,
                type: "reserwation_canceled",
                creationTime: new Date(),
                companyChanged: true,
              },
            });

            allWorkerAlertsToSave.push(userAlertToSave);
          }

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
        }

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
      }
    )
    .then(() => {
      return CompanyUsersInformations.deleteMany({ companyId: companyId });
    })
    .then(() => {
      return CompanyAvailability.deleteOne({ companyId: companyId });
    })
    .then(() => {
      return Company.findOneAndDelete({ _id: companyId })
        .select("email _id")
        .then((companyData) => {
          if (!!companyData) {
            notifications.sendEmail({
              email: companyData.email,
              title: `Usunięto działalność!`,
              defaultText: `Działalność została usunięta`,
            });
            return true;
          } else {
            const error = new Error("Błąd podczas usuwania działalności.");
            error.statusCode = 423;
            throw error;
          }
        });
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
      const bulkArrayToUpdate = [];

      bulkArrayToUpdate.push({
        updateOne: {
          filter: {
            _id: resultCompanyDoc.owner,
          },
          update: {
            $set: {
              company: null,
            },
            $pull: {
              allCompanys: companyId,
            },
          },
        },
      });
      resultCompanyDoc.workers.forEach((worker) => {
        bulkArrayToUpdate.push({
          updateOne: {
            filter: {
              _id: worker.user,
            },
            update: {
              $set: {
                company: null,
              },
              $pull: {
                allCompanys: companyId,
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
            err.message = "Błąd podczas usuwania uprawnień użytkownikom.";
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
            notifications.sendEmail({
              email: companyData.email,
              title: `Usunięto działalność!`,
              defaultText: `Działalność została usunięta`,
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
  const smsReserwationChangedUserAvaible =
    req.body.smsReserwationChangedUserAvaible;
  const smsNotifactionAvaible = req.body.smsNotifactionAvaible;
  const smsCanceledAvaible = req.body.smsCanceledAvaible;
  const smsChangedAvaible = req.body.smsChangedAvaible;
  const smsServiceCreatedAvaible = req.body.smsServiceCreatedAvaible;
  const smsServiceChangedAvaible = req.body.smsServiceChangedAvaible;
  const smsServiceFinishedAvaible = req.body.smsServiceFinishedAvaible;
  const smsServiceCanceledAvaible = req.body.smsServiceCanceledAvaible;
  const smsServiceDeletedAvaible = req.body.smsServiceDeletedAvaible;
  const smsCommunitingNotificationAvaible =
    req.body.smsCommunitingNotificationAvaible;
  const smsCommunitingCreatedAvaible = req.body.smsCommunitingCreatedAvaible;
  const smsCommunitingChangedAvaible = req.body.smsCommunitingChangedAvaible;
  const smsCommunitingCanceledAvaible = req.body.smsCommunitingCanceledAvaible;
  const smsCommunitingDeletedAvaible = req.body.smsCommunitingDeletedAvaible;

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
      "_id owner smsReserwationChangedUserAvaible smsReserwationAvaible smsNotifactionAvaible smsCanceledAvaible smsChangedAvaible smsServiceCreatedAvaible smsServiceFinishedAvaible smsServiceChangedAvaible smsServiceDeletedAvaible smsServiceCanceledAvaible smsCommunitingNotificationAvaible smsCommunitingCreatedAvaible smsCommunitingChangedAvaible smsCommunitingDeletedAvaible smsCommunitingCanceledAvaible"
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
      companyDoc.smsReserwationChangedUserAvaible =
        smsReserwationChangedUserAvaible;
      companyDoc.smsNotifactionAvaible = smsNotifactionAvaible;
      companyDoc.smsCanceledAvaible = smsCanceledAvaible;
      companyDoc.smsChangedAvaible = smsChangedAvaible;
      companyDoc.smsServiceCreatedAvaible = smsServiceCreatedAvaible;
      companyDoc.smsServiceChangedAvaible = smsServiceChangedAvaible;
      companyDoc.smsServiceFinishedAvaible = smsServiceFinishedAvaible;
      companyDoc.smsServiceCanceledAvaible = smsServiceCanceledAvaible;
      companyDoc.smsServiceDeletedAvaible = smsServiceDeletedAvaible;
      companyDoc.smsCommunitingNotificationAvaible =
        smsCommunitingNotificationAvaible;
      companyDoc.smsCommunitingCreatedAvaible = smsCommunitingCreatedAvaible;
      companyDoc.smsCommunitingChangedAvaible = smsCommunitingChangedAvaible;
      companyDoc.smsCommunitingCanceledAvaible = smsCommunitingCanceledAvaible;
      companyDoc.smsCommunitingDeletedAvaible = smsCommunitingDeletedAvaible;
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

exports.companySMSSendClients = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const allClients = req.body.allClients;
  const selectedClients = req.body.selectedClients;
  const textMessage = req.body.textMessage;

  const mapSelectedClients = selectedClients.map((item) =>
    mongoose.Types.ObjectId(item)
  );

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const extraQueryToSelectIdsUsers =
    selectedClients.length > 0 && !!!allClients
      ? {
          $in: ["$$userInfo.userId", mapSelectedClients],
        }
      : {};

  Company.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(companyId),
      },
    },
    {
      $project: {
        _id: 1,
        owner: 1,
        name: 1,
        usersInformationUsersInfo: 1,
        usersInformation: {
          $filter: {
            input: "$usersInformation",
            as: "userInfo",
            cond: {
              $and: [
                { ...extraQueryToSelectIdsUsers },
                {
                  $eq: ["$$userInfo.isBlocked", false],
                },
              ],
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "usersInformation.userId",
        foreignField: "_id",
        as: "usersInformationUsersInfo",
      },
    },
    {
      $project: {
        _id: 1,
        owner: 1,
        name: 1,
        usersInformationUsersInfo: {
          _id: 1,
          phone: 1,
          phoneVerified: 1,
          whiteListVerifiedPhones: 1,
        },
        usersInformation: {
          _id: 1,
          phone: 1,
          isBlocked: 1,
          userId: 1,
        },
      },
    },
  ])
    .then((companyDocQuery) => {
      const resultCompanyDoc = companyDocQuery[0];
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
      const lengthCompanyClients = companyDoc.usersInformationUsersInfo.length;
      return Company.updateOne(
        {
          _id: companyId,
          sms: { $gte: lengthCompanyClients },
        },
        {
          $inc: {
            sms: -lengthCompanyClients,
          },
          $addToSet: {
            raportSMS: {
              year: new Date().getFullYear(),
              month: new Date().getMonth() + 1,
              count: lengthCompanyClients,
              isAdd: false,
              title: "sms_client",
            },
          },
        },
        { upsert: true, safe: true },
        null
      )
        .then(() => {
          companyDoc.usersInformationUsersInfo.forEach((userInfo) => {
            let selectedPhoneNumber = null;
            if (!!userInfo.phoneVerified) {
              selectedPhoneNumber = userInfo.phone;
            } else {
              if (!!userInfo.whiteListVerifiedPhones) {
                if (userInfo.whiteListVerifiedPhones.length > 0) {
                  selectedPhoneNumber =
                    userInfo.whiteListVerifiedPhones[
                      userInfo.whiteListVerifiedPhones.length - 1
                    ];
                }
              }
            }
            if (!!selectedPhoneNumber) {
              const userPhone = Buffer.from(
                selectedPhoneNumber,
                "base64"
              ).toString("utf-8");

              const validComapnyName =
                companyDoc.name.length > 32
                  ? companyDoc.name.slice(0, 32)
                  : companyDoc.name;
              const params = {
                Message: `${textMessage} - ${validComapnyName.toUpperCase()}`,
                MessageStructure: "string",
                PhoneNumber: `+48${userPhone}`,
                MessageAttributes: {
                  "AWS.SNS.SMS.SenderID": {
                    DataType: "String",
                    StringValue: "Meetsy",
                  },
                },
              };
              // sns.publish(params, function (err, data) {
              //   if (err) console.log(err, err.stack);
              // });
            }
          });
          return lengthCompanyClients;
        })
        .catch((err) => {
          console.log(err);
          const error = new Error("Brak odpowiedniej ilosci sms.");
          error.statusCode = 441;
          throw error;
        });
    })
    .then((countMessages) => {
      res.status(201).json({
        countMessages: countMessages,
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

exports.getGeolocation = (req, res, next) => {
  const adress = req.body.adress;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Geolocations.findOne({
    adress: convertString(adress.toLowerCase().trim()),
  })
    .then((geolocationData) => {
      if (!!geolocationData) {
        return {
          adress: geolocationData.adress,
          lat: geolocationData.lat,
          long: geolocationData.long,
        };
      } else {
        const url =
          "https://maps.googleapis.com/maps/api/geocode/json?address=" +
          adress +
          "&key=" +
          GOOGLE_API_KEY;

        return rp(url)
          .then((resultRp) => {
            if (!!resultRp) {
              const resultReq = JSON.parse(resultRp);
              const newgeolocation = new Geolocations({
                adress: convertString(adress.toLowerCase().trim()),
                lat: resultReq.results[0].geometry.location.lat,
                long: resultReq.results[0].geometry.location.lng,
              });
              newgeolocation.save();
              return {
                adress: adress.toLowerCase().trim(),
                lat: resultReq.results[0].geometry.location.lat,
                long: resultReq.results[0].geometry.location.lng,
              };
            } else {
              const error = new Error("Błąd podczas pobierania geolokalizacji");
              error.statusCode = 421;
              throw error;
            }
          })
          .catch((err) => {
            const error = new Error("Błąd podczas pobierania geolokalizacji");
            error.statusCode = 420;
            throw error;
          });
      }
    })
    .then((resultGeolocation) => {
      res.status(201).json({
        geolocation: resultGeolocation,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania geolokalizacji.";
      }
      next(err);
    });
};

exports.getCompanyMarker = (req, res, next) => {
  const companyId = req.body.companyId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    accountVerified: true,
    pauseCompany: false,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select(
      "adress city district linkPath name services title opinionsCount opinionsValue mainImageUrl imagesUrl code"
    )
    .then((companyData) => {
      if (!!companyData) {
        const unhashedAdress = Buffer.from(
          companyData.adress,
          "base64"
        ).toString("utf-8");

        const dataToSent = {
          adress: unhashedAdress,
          city: companyData.city,
          district: companyData.district,
          linkPath: companyData.linkPath,
          name: companyData.name,
          services: companyData.services,
          code: companyData.code,
          title: companyData.title,
          _id: companyData._id,
          mainImageUrl: companyData.mainImageUrl,
          imagesUrl: companyData.imagesUrl,
          opinionsCount: !!companyData.opinionsCount
            ? companyData.opinionsCount
            : 0,
          opinionsValue: !!companyData.opinionsValue
            ? companyData.opinionsValue
            : 0,
        };
        res.status(201).json({
          companyMarker: dataToSent,
        });
      } else {
        const error = new Error("Nie znaleziono firmy");
        error.statusCode = 420;
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

exports.companyReport = (req, res, next) => {
  const companyId = req.body.companyId;
  const reportValue = req.body.reportValue;
  const userId = req.userId;
  const opinionId = req.body.opinionId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
  })
    .select("_id")
    .then((companyData) => {
      if (!!companyData) {
        return Report.find({
          createdAt: {
            $gte: new Date(
              new Date(new Date().setHours(0)).setMinutes(0)
            ).toISOString(),
          },
        }).then((docReport) => {
          let reportValid = true;
          if (!!docReport) {
            if (docReport.length >= 3) {
              reportValid = false;
            }
          }
          if (reportValid) {
            const newReport = new Report({
              whoReportedUser: userId,
              reportedCompany: companyId,
              reportedValue: reportValue,
              opinionId: !!opinionId ? opinionId : null,
            });
            return newReport.save();
          } else {
            const error = new Error(
              "Nie można dokonać reportu więcej niż 3 razy dziennie"
            );
            error.statusCode = 440;
            throw error;
          }
        });
      } else {
        const error = new Error("Nie znaleziono firmy");
        error.statusCode = 420;
        throw error;
      }
    })
    .then(() => {
      res.status(201).json({
        message: "Zgłoszono firmę",
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

exports.companyAddLink = (req, res, next) => {
  const companyId = req.body.companyId;
  const pathValue = req.body.pathValue;
  const userId = req.userId;
  const pathCompanyName = encodeURI(convertLinkString(pathValue));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    linkPath: pathCompanyName,
  })
    .select("_id pathValue")
    .then((companyData) => {
      if (!!!companyData) {
        Company.updateOne(
          {
            _id: companyId,
            owner: userId,
          },
          {
            $set: {
              linkPath: pathCompanyName,
            },
          }
        ).then((resultSave) => {
          if (!!resultSave.nModified) {
            res.status(201).json({
              message: "Zaktualizowano link firmowy",
            });
          } else {
            res.status(422).json({
              message: "Błąd podczas aktualizacji",
            });
          }
        });
      } else {
        const error = new Error("Podany link jest zajęty");
        error.statusCode = 440;
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

exports.companyUpdateNip = (req, res, next) => {
  const companyId = req.body.companyId;
  const nipValue = req.body.nipValue;
  const userId = req.userId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    owner: userId,
  })
    .select("_id nip dataToInvoice dateUpdateNip phone")
    .then(async (companyData) => {
      if (!!companyData) {
        const validDateUpdateNip = !!companyData.dateUpdateNip
          ? new Date(companyData.dateUpdateNip)
          : new Date();
        if (validDateUpdateNip <= new Date()) {
          const companyInfoByNip = await getGUSInfo(nipValue);
          if (!!companyInfoByNip) {
            if (
              !!companyInfoByNip.nazwa &&
              !!companyInfoByNip.miejscowosc &&
              !!companyInfoByNip.kodPocztowy &&
              !!companyInfoByNip.ulica
            ) {
              const dateCompanyToInvoice = {
                name: companyInfoByNip.nazwa,
                city: companyInfoByNip.miejscowosc,
                postalCode: companyInfoByNip.kodPocztowy,
                street: `${companyInfoByNip.ulica} ${
                  !!companyInfoByNip.nrNieruchomosci
                    ? companyInfoByNip.nrNieruchomosci
                    : 1
                }${
                  !!companyInfoByNip.nrLokalu
                    ? `/${companyInfoByNip.nrLokalu}`
                    : ""
                }`,
              };
              companyData.dataToInvoice = dateCompanyToInvoice;
              companyData.nip = nipValue;
              companyData.dateUpdateNip = new Date(
                new Date().setDate(new Date().getDate() + 1)
              );
              return companyData.save();
            } else {
              const error = new Error("Niepoprawny nip");
              error.statusCode = 440;
              throw error;
            }
          } else {
            const error = new Error("Niepoprawny nip");
            error.statusCode = 440;
            throw error;
          }
        } else {
          const error = new Error("Nie można teraz zaktualizować danych nip");
          error.statusCode = 441;
          throw error;
        }
      } else {
        const error = new Error("Brak firmy");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((resultSaveCompany) => {
      RegisterCompany.updateOne(
        {
          companyId: resultSaveCompany._id,
        },
        {
          $set: {
            nip: resultSaveCompany.nip,
          },
        }
      )
        .then(() => {})
        .catch(() => {});
      res.status(201).json({
        nip: resultSaveCompany.nip,
        dataToInvoice: resultSaveCompany.dataToInvoice,
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

exports.companyUpdateNipInfo = (req, res, next) => {
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
    owner: userId,
  })
    .select("_id nip dataToInvoice dateUpdateNip phone")
    .then(async (companyData) => {
      if (!!companyData) {
        const validDateUpdateNip = !!companyData.dateUpdateNip
          ? new Date(companyData.dateUpdateNip)
          : new Date();
        if (validDateUpdateNip <= new Date()) {
          const companyInfoByNip = await getGUSInfo(companyData.nip);
          if (!!companyInfoByNip) {
            if (
              !!companyInfoByNip.nazwa &&
              !!companyInfoByNip.miejscowosc &&
              !!companyInfoByNip.kodPocztowy &&
              !!companyInfoByNip.ulica
            ) {
              const dateCompanyToInvoice = {
                name: companyInfoByNip.nazwa,
                city: companyInfoByNip.miejscowosc,
                postalCode: companyInfoByNip.kodPocztowy,
                street: `${companyInfoByNip.ulica} ${
                  !!companyInfoByNip.nrNieruchomosci
                    ? companyInfoByNip.nrNieruchomosci
                    : 1
                }${
                  !!companyInfoByNip.nrLokalu
                    ? `/${companyInfoByNip.nrLokalu}`
                    : ""
                }`,
              };
              companyData.dataToInvoice = dateCompanyToInvoice;
              companyData.dateUpdateNip = new Date(
                new Date().setDate(new Date().getDate() + 1)
              );
              return companyData.save();
            } else {
              const error = new Error("Niepoprawny nip");
              error.statusCode = 440;
              throw error;
            }
          } else {
            const error = new Error("Niepoprawny nip");
            error.statusCode = 440;
            throw error;
          }
        } else {
          const error = new Error("Nie można teraz zaktualizować danych nip");
          error.statusCode = 441;
          throw error;
        }
      } else {
        const error = new Error("Brak firmy");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((resultSaveCompany) => {
      RegisterCompany.updateOne(
        {
          companyId: resultSaveCompany._id,
        },
        {
          $set: {
            nip: resultSaveCompany.nip,
          },
        }
      )
        .then(() => {})
        .catch(() => {});
      res.status(201).json({
        nip: resultSaveCompany.nip,
        dataToInvoice: resultSaveCompany.dataToInvoice,
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

exports.companyAddService = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const name = req.body.name;
  const surname = req.body.surname;
  const email = req.body.email;
  const isActiveUser = req.body.isActiveUser;
  const phone = req.body.phone;
  const objectName = req.body.objectName;
  const description = req.body.description;
  const cost = req.body.cost;
  const statusValue = req.body.statusValue;
  const workerUserId = req.body.workerUserId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select("_id owner workers._id workers.user workers.permissions")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          const selectedWorker = companyData.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 8
            );
          }
        }

        const hashedPhoneNumber = Buffer.from(
          phone.toString(),
          "utf-8"
        ).toString("base64");

        return User.findOne({
          phone: hashedPhoneNumber,
          phoneVerified: true,
        })
          .select("_id")
          .then((resultToUser) => {
            if (isActiveUser) {
              if (!!resultToUser) {
                let userIsInWorkersInCompany =
                  companyData.owner == resultToUser._id;
                if (!userIsInWorkersInCompany) {
                  userIsInWorkersInCompany = companyData.workers.some(
                    (worker) => {
                      return worker.user == resultToUser._id;
                    }
                  );
                }

                if (!userIsInWorkersInCompany) {
                  const newService = new Service({
                    userId: !!resultToUser ? resultToUser._id : null,
                    companyId: companyData._id,
                    workerUserId: hasPermission ? workerUserId : userId,
                    objectName: objectName,
                    description: description,
                    cost: cost,
                    statusValue: statusValue,
                    dateStart: statusValue >= 1 ? new Date() : null,
                    dateService: statusValue >= 2 ? new Date() : null,
                    dateEnd: statusValue >= 3 ? new Date() : null,
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear(),
                    day: new Date().getDate(),
                    createdSMS: false,
                  });
                  return newService.save();
                } else {
                  const error = new Error("Użytkownik pracuje w działalności");
                  error.statusCode = 441;
                  throw error;
                }
              } else {
                const error = new Error("Brak użytkownika");
                error.statusCode = 440;
                throw error;
              }
            } else {
              const hashedName = Buffer.from(name.toString(), "utf-8").toString(
                "base64"
              );
              const hashedSurname = Buffer.from(
                surname.toString(),
                "utf-8"
              ).toString("base64");

              if (!!resultToUser) {
                let userIsInWorkersInCompany = companyData.owner == userId;
                if (!!resultToUser) {
                  if (!userIsInWorkersInCompany) {
                    userIsInWorkersInCompany = companyData.workers.some(
                      (worker) => {
                        return worker.user == resultToUser._id;
                      }
                    );
                  }
                }
                if (userIsInWorkersInCompany) {
                  const error = new Error("Użytkownik pracuje w działalności");
                  error.statusCode = 441;
                  throw error;
                }
              }

              const newService = new Service({
                userId: !!resultToUser ? resultToUser._id : null,
                companyId: companyData._id,
                workerUserId: hasPermission ? workerUserId : userId,
                name: hashedName,
                surname: hashedSurname,
                email: !!email ? email : null,
                phone: hashedPhoneNumber,
                objectName: objectName,
                description: description,
                cost: cost,
                statusValue: statusValue,
                dateStart: statusValue >= 1 ? new Date() : null,
                dateService: statusValue >= 2 ? new Date() : null,
                dateEnd: statusValue >= 3 ? new Date() : null,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                day: new Date().getDate(),
                createdSMS: false,
              });
              return newService.save();
            }
          });
      } else {
        const error = new Error("Brak firmy");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((resultSaveService) => {
      return CompanyUsersInformations.findOne({
        userId: userId,
        companyId: companyId,
      }).then((resultCompanyUsersInformations) => {
        if (!!!resultCompanyUsersInformations) {
          const newUserCompanyInfo = new CompanyUsersInformations({
            userId: userId,
            companyId: companyId,
            messages: [],
          });
          newUserCompanyInfo.save();
        }
        return resultSaveService;
      });
    })
    .then((resultSaveService) => {
      return resultSaveService
        .populate({
          path: "companyId",
          select: "_id linkPath name",
        })
        .populate(
          {
            path: "userId workerUserId",
            select: "name surname _id",
          },
          async function (err, populateService) {
            const emailContent = `Utworzono serwis dnia: ${
              resultSaveService.day < 10
                ? `0${resultSaveService.day}`
                : resultSaveService.day
            }-${
              resultSaveService.month < 10
                ? `0${resultSaveService.month}`
                : resultSaveService.month
            }-${resultSaveService.year}, przedmiotu: ${
              resultSaveService.objectName
            }, przewidywany koszt: ${
              !!resultSaveService.cost ? resultSaveService.cost : "nieznany"
            }, numer serwisu: ${resultSaveService._id}`;

            const payload = {
              title: `Utworzono serwis dnia: ${
                resultSaveService.day < 10
                  ? `0${resultSaveService.day}`
                  : resultSaveService.day
              }-${
                resultSaveService.month < 10
                  ? `0${resultSaveService.month}`
                  : resultSaveService.month
              }-${resultSaveService.year}, przedmiotu: ${
                resultSaveService.objectName
              }, przewidywany koszt: ${
                !!resultSaveService.cost ? resultSaveService.cost : "nieznany"
              }, numer serwisu: ${resultSaveService._id}`,
              body: "this is the body",
              icon: "images/someImageInPath.png",
            };

            const emailSubject = `Dodano serwis`;
            const message = `Utworzono serwis dnia: ${
              resultSaveService.day < 10
                ? `0${resultSaveService.day}`
                : resultSaveService.day
            }-${
              resultSaveService.month < 10
                ? `0${resultSaveService.month}`
                : resultSaveService.month
            }-${resultSaveService.year}, przedmiotu: ${
              resultSaveService.objectName
            }, przewidywany koszt: ${
              !!resultSaveService.cost ? resultSaveService.cost : "nieznany"
            }, numer serwisu: ${resultSaveService._id}`;
            let customPhone = !!resultSaveService.phone
              ? resultSaveService.phone
              : null;
            if (!!customPhone) {
              customPhone = Buffer.from(customPhone, "base64").toString(
                "utf-8"
              );
            }

            const { resultSMS } = await notifications.sendAll({
              usersId: [
                populateService.userId._id,
                populateService.workerUserId._id,
              ],
              clientId: populateService.userId._id,
              emailContent: {
                customEmail: null,
                emailTitle: emailSubject,
                emailMessage: emailContent,
              },
              notificationContent: {
                typeAlert: "serviceId",
                dateAlert: populateService,
                typeNotification: "service_created",
                payload: payload,
                companyChanged: true,
              },
              smsContent: {
                companyId: companyId,
                customPhone: customPhone,
                companySendSMSValidField: "smsServiceCreatedAvaible",
                titleCompanySendSMS: "sms_added_service",
                message: message,
              },
            });

            if (!!resultSMS) {
              Service.updateOne(
                {
                  _id: resultSaveService._id,
                },
                {
                  $set: {
                    createdSMS: true,
                  },
                }
              ).then(() => {});
            }

            populateService.phone = null;
            res.status(200).json({
              newService: populateService,
            });
          }
        );
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danego konta firmowego";
      }
      next(err);
    });
};

exports.companyGetServices = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const year = req.body.year;
  const month = req.body.month;
  const workerUserId = req.body.workerUserId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select("_id owner workers._id workers.user workers.permissions")
    .populate("workers.user", "_id name surname")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          const selectedWorker = companyData.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 8
            );
          }
        }
        return Service.find({
          year: year,
          month: month,
          workerUserId: hasPermission ? workerUserId : userId,
          companyId: companyData._id,
          isDeleted: { $in: [false, null] },
        })
          .select("-phone")
          .populate("workerUserId userId", "_id name surname")
          .then((resultServices) => {
            res.status(200).json({
              services: resultServices,
              workers: hasPermission ? companyData.workers : null,
            });
          });
      } else {
        const error = new Error("Brak firmy");
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

exports.companyDeleteServices = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const serviceId = req.body.serviceId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
  })
    .select("_id owner workers._id workers.user")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          hasPermission = companyData.workers.some((worker) => {
            return worker.user == userId;
          });
        }
        if (!!hasPermission) {
          return Service.findOne({
            _id: serviceId,
          })
            .select(
              "workerUserId companyId userId createdAt objectName description city timeStart timeEnd day month year phone"
            )
            .populate("companyId", "_id name linkPath")
            .populate("workerUserId userId", "_id name surname")
            .then((serviceDoc) => {
              if (!!serviceDoc) {
                if (!!serviceDoc.statusValue !== 3) {
                  serviceDoc.isDeleted = true;

                  if (!!serviceDoc.opinionId) {
                    Opinion.deleteOne({
                      _id: serviceDoc.opinionId,
                    }).then(() => {});
                  }
                  return serviceDoc.save();
                } else {
                  const error = new Error(
                    "Nie można usunąć zakończonego serwisu"
                  );
                  error.statusCode = 442;
                  throw error;
                }
              } else {
                const error = new Error("Brak serwisu");
                error.statusCode = 402;
                throw error;
              }
            });
        } else {
          const error = new Error("Brak uprawnień");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak firmy");
        error.statusCode = 422;
        throw error;
      }
    })
    .then(async (savedServiceDoc) => {
      const emailContent = `Usunięto serwis z dnia: ${
        savedServiceDoc.day < 10
          ? `0${savedServiceDoc.day}`
          : savedServiceDoc.day
      }-${
        savedServiceDoc.month < 10
          ? `0${savedServiceDoc.month}`
          : savedServiceDoc.month
      }-${savedServiceDoc.year}, przedmiotu: ${savedServiceDoc.objectName}`;

      const payload = {
        title: `Usunięto serwis z dnia: ${
          savedServiceDoc.day < 10
            ? `0${savedServiceDoc.day}`
            : savedServiceDoc.day
        }-${
          savedServiceDoc.month < 10
            ? `0${savedServiceDoc.month}`
            : savedServiceDoc.month
        }-${savedServiceDoc.year}, przedmiotu: ${savedServiceDoc.objectName}`,
        body: "this is the body",
        icon: "images/someImageInPath.png",
      };

      const emailSubject = `Usunięto serwis serwis`;
      const message = `Usunięto serwis z dnia: ${
        savedServiceDoc.day < 10
          ? `0${savedServiceDoc.day}`
          : savedServiceDoc.day
      }-${
        savedServiceDoc.month < 10
          ? `0${savedServiceDoc.month}`
          : savedServiceDoc.month
      }-${savedServiceDoc.year}, przedmiotu: ${savedServiceDoc.objectName}`;
      let customPhone = !!savedServiceDoc.phone ? savedServiceDoc.phone : null;
      if (!!customPhone) {
        customPhone = Buffer.from(customPhone, "base64").toString("utf-8");
      }

      const { resultSMS } = await notifications.sendAll({
        usersId: [savedServiceDoc.userId._id, savedServiceDoc.workerUserId._id],
        clientId: savedServiceDoc.userId._id,
        emailContent: {
          customEmail: null,
          emailTitle: emailSubject,
          emailMessage: emailContent,
        },
        notificationContent: {
          typeAlert: "serviceId",
          dateAlert: savedServiceDoc,
          typeNotification: "service_canceled",
          payload: payload,
          companyChanged: true,
        },
        smsContent: {
          companyId: companyId,
          customPhone: customPhone,
          companySendSMSValidField: "smsServiceCanceledAvaible",
          titleCompanySendSMS: "sms_canceled_service",
          message: message,
        },
      });

      if (!!resultSMS) {
        Service.updateOne(
          {
            _id: savedServiceDoc._id,
          },
          {
            $set: {
              deletedSMS: true,
            },
          }
        ).then(() => {});
      }
      res.status(200).json({
        message: "Usunieto serwis",
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

exports.companyUpdateServices = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const serviceId = req.body.serviceId;
  const objectName = req.body.objectName;
  const description = req.body.description;
  const cost = req.body.cost;
  const statusValue = req.body.statusValue;
  const selectedWorkerUserId = req.body.selectedWorkerUserId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select("_id owner workers._id workers.user workers.permissions")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          const selectedWorker = companyData.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 8
            );
          }
        }
        const validPermission = !!hasPermission ? {} : { workerUserId: userId };
        const validDateService =
          statusValue == 2 ? { dateService: new Date() } : {};
        const validDateServiceEnd =
          statusValue == 3 ? { dateEnd: new Date() } : {};

        return Service.updateOne(
          {
            _id: serviceId,
            companyId: companyId,
            ...validPermission,
          },
          {
            $set: {
              workerUserId: selectedWorkerUserId,
              objectName: objectName,
              description: description,
              cost: cost,
              statusValue: statusValue,
              ...validDateService,
              ...validDateServiceEnd,
            },
          }
        ).then(() => {
          return Service.findOne({
            _id: serviceId,
            companyId: companyId,
            ...validPermission,
          })
            .select(
              "_id city description userId companyId month year day objectName email workerUserId phone"
            )
            .populate("companyId userId", "name surname linkPath")
            .then(async (resultSavetService) => {
              if (!!resultSavetService) {
                const nameStatusService =
                  statusValue == 3
                    ? "Ukończono"
                    : statusValue == 4
                    ? "Anulowano"
                    : "Edytowano";

                const emailContent = `${nameStatusService} serwis z dnia: ${
                  resultSavetService.day < 10
                    ? `0${resultSavetService.day}`
                    : resultSavetService.day
                }-${
                  resultSavetService.month < 10
                    ? `0${resultSavetService.month}`
                    : resultSavetService.month
                }-${resultSavetService.year}, przedmiotu: ${
                  resultSavetService.objectName
                }`;

                const payload = {
                  title: `${nameStatusService} serwis z dnia: ${
                    resultSavetService.day < 10
                      ? `0${resultSavetService.day}`
                      : resultSavetService.day
                  }-${
                    resultSavetService.month < 10
                      ? `0${resultSavetService.month}`
                      : resultSavetService.month
                  }-${resultSavetService.year}, przedmiotu: ${
                    resultSavetService.objectName
                  }`,
                  body: "this is the body",
                  icon: "images/someImageInPath.png",
                };

                const emailSubject = `${nameStatusService} serwis`;
                const message = `${nameStatusService} serwis z dnia: ${
                  resultSavetService.day < 10
                    ? `0${resultSavetService.day}`
                    : resultSavetService.day
                }-${
                  resultSavetService.month < 10
                    ? `0${resultSavetService.month}`
                    : resultSavetService.month
                }-${resultSavetService.year}, przedmiotu: ${
                  resultSavetService.objectName
                }`;
                let customPhone = !!resultSavetService.phone
                  ? resultSavetService.phone
                  : null;
                if (!!customPhone) {
                  customPhone = Buffer.from(customPhone, "base64").toString(
                    "utf-8"
                  );
                }

                const { resultSMS } = await notifications.sendAll({
                  usersId: [
                    resultSavetService.userId._id,
                    resultSavetService.workerUserId._id,
                  ],
                  clientId: resultSavetService.userId._id,
                  emailContent: {
                    customEmail: null,
                    emailTitle: emailSubject,
                    emailMessage: emailContent,
                  },
                  notificationContent: {
                    typeAlert: "serviceId",
                    dateAlert: resultSavetService,
                    typeNotification:
                      statusValue == 3
                        ? "service_finished"
                        : statusValue == 4
                        ? "service_canceled"
                        : "service_changed",
                    payload: payload,
                    companyChanged: true,
                  },
                  smsContent: {
                    companyId: companyId,
                    customPhone: customPhone,
                    companySendSMSValidField:
                      statusValue == 3
                        ? "smsServiceFinishedAvaible"
                        : statusValue == 4
                        ? "smsServiceCanceledAvaible"
                        : "smsServiceChangedAvaible",
                    titleCompanySendSMS:
                      statusValue == 3
                        ? "sms_finished_service"
                        : statusValue == 4
                        ? "sms_canceled_service"
                        : "sms_changed_service",
                    message: message,
                  },
                });

                if (!!resultSMS) {
                  const validUpdateSMSObject =
                    statusValue == 3
                      ? { finishedSMS: true }
                      : statusValue == 4
                      ? { canceledSMS: true }
                      : { changedSMS: true };
                  Service.updateOne(
                    {
                      _id: resultSavetService._id,
                    },
                    {
                      $set: validUpdateSMSObject,
                    }
                  ).then(() => {});
                }
                res.status(200).json({
                  message: "Zaktualizwowano serwis",
                });
              }
            });
        });
      } else {
        const error = new Error("Brak firmy");
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

exports.getServiceCustomUserPhone = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;
  const serviceId = req.body.serviceId;

  Company.findOne({ _id: companyId })
    .select("_id workers.permissions workers.user owner workers._id")
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
          return Service.findOne({
            _id: serviceId,
          })
            .select("_id userId phone")
            .populate(
              "userId",
              "_id phone whiteListVerifiedPhones phoneVerified"
            )
            .then((serviceDoc) => {
              if (!!serviceDoc) {
                if (!!serviceDoc.userId) {
                  let selectedPhoneNumber = null;
                  if (!!serviceDoc.userId.phoneVerified) {
                    selectedPhoneNumber = serviceDoc.userId.phone;
                  } else {
                    if (!!serviceDoc.userId.whiteListVerifiedPhones) {
                      if (
                        serviceDoc.userId.whiteListVerifiedPhones.length > 0
                      ) {
                        selectedPhoneNumber =
                          serviceDoc.userId.whiteListVerifiedPhones[
                            serviceDoc.userId.whiteListVerifiedPhones.length - 1
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
                } else if (!!serviceDoc.phone) {
                  const userPhoneService = Buffer.from(
                    serviceDoc.phone,
                    "base64"
                  ).toString("utf-8");
                  res.status(201).json({
                    userPhone: userPhoneService,
                  });
                } else {
                  const error = new Error("Brak podanego użytkownika.");
                  error.statusCode = 401;
                  throw error;
                }
              } else {
                const error = new Error("Brak usługi.");
                error.statusCode = 422;
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

exports.getServiceCustomUserPhoneCommuniting = (req, res, next) => {
  const companyId = req.body.companyId;
  const userId = req.userId;
  const communitingId = req.body.communitingId;

  Company.findOne({ _id: companyId })
    .select("_id workers._id workers.permissions workers.user owner")
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
          return Communiting.findOne({
            _id: communitingId,
          })
            .select("_id userId phone")
            .populate(
              "userId",
              "_id phone whiteListVerifiedPhones phoneVerified"
            )
            .then((serviceDoc) => {
              if (!!serviceDoc) {
                if (!!serviceDoc.userId) {
                  let selectedPhoneNumber = null;
                  if (!!serviceDoc.userId.phoneVerified) {
                    selectedPhoneNumber = serviceDoc.userId.phone;
                  } else {
                    if (!!serviceDoc.userId.whiteListVerifiedPhones) {
                      if (
                        serviceDoc.userId.whiteListVerifiedPhones.length > 0
                      ) {
                        selectedPhoneNumber =
                          serviceDoc.userId.whiteListVerifiedPhones[
                            serviceDoc.userId.whiteListVerifiedPhones.length - 1
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
                } else if (!!serviceDoc.phone) {
                  const userPhoneService = Buffer.from(
                    serviceDoc.phone,
                    "base64"
                  ).toString("utf-8");
                  res.status(201).json({
                    userPhone: userPhoneService,
                  });
                } else {
                  const error = new Error("Brak podanego użytkownika.");
                  error.statusCode = 401;
                  throw error;
                }
              } else {
                const error = new Error("Brak usługi.");
                error.statusCode = 422;
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

exports.companyGetCommunitings = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const year = req.body.year;
  const month = req.body.month;
  const workerUserId = req.body.workerUserId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select("_id owner workers._id workers.user workers.permissions")
    .populate("workers.user", "_id name surname")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          const selectedWorker = companyData.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 10
            );
          }
        }
        return Communiting.find({
          year: year,
          month: month,
          workerUserId: hasPermission ? workerUserId : userId,
          companyId: companyData._id,
          isDeleted: { $in: [false, null] },
        })
          .select("-phone")
          .populate("workerUserId userId", "_id name surname")
          .then((resultCommuniting) => {
            res.status(200).json({
              communitings: resultCommuniting,
              workers: hasPermission ? companyData.workers : null,
            });
          });
      } else {
        const error = new Error("Brak firmy");
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

exports.companyAddCommuniting = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const name = req.body.name;
  const surname = req.body.surname;
  const email = req.body.email;
  const isActiveUser = req.body.isActiveUser;
  const phone = req.body.phone;
  const description = req.body.description;
  const cost = req.body.cost;
  const statusValue = req.body.statusValue;
  const workerUserId = req.body.workerUserId;
  const cityInput = req.body.cityInput;
  const streetInput = req.body.streetInput;
  const timeStart = req.body.timeStart;
  const timeEnd = req.body.timeEnd;
  const addWorkerTime = req.body.addWorkerTime;
  const fullDate = req.body.fullDate;

  const arrayDateFull = fullDate.split("-");
  const splitDateStart = timeStart.split(":");

  const actualDate = new Date(
    Number(arrayDateFull[2]),
    Number(arrayDateFull[1]) - 1,
    Number(arrayDateFull[0]),
    Number(splitDateStart[0]),
    Number(splitDateStart[1])
  );

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select("_id owner workers._id workers.user workers.permissions")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          const selectedWorker = companyData.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 10
            );
          }
        }

        const hashedPhoneNumber = Buffer.from(
          phone.toString(),
          "utf-8"
        ).toString("base64");

        return User.findOne({
          phone: hashedPhoneNumber,
          phoneVerified: true,
        })
          .select("_id")
          .then((resultToUser) => {
            let newReserwationWorker = null;

            if (isActiveUser) {
              if (!!resultToUser) {
                let userIsInWorkersInCompany =
                  companyData.owner == resultToUser._id;
                if (!userIsInWorkersInCompany) {
                  userIsInWorkersInCompany = companyData.workers.some(
                    (worker) => {
                      return worker.user == resultToUser._id;
                    }
                  );
                }
                if (!userIsInWorkersInCompany) {
                  if (addWorkerTime) {
                    newReserwationWorker = new Reserwation({
                      fromUser: userId,
                      toWorkerUserId: workerUserId,
                      company: companyId,
                      dateStart: timeStart,
                      dateEnd: timeEnd,
                      costReserwation: null,
                      timeReserwation: null,
                      visitNotFinished: false,
                      visitCanceled: false,
                      visitChanged: false,
                      workerReserwation: true,
                      dateYear: Number(arrayDateFull[2]),
                      dateMonth: Number(arrayDateFull[1]),
                      dateDay: Number(arrayDateFull[0]),
                      reserwationMessage: ``,
                      costReserwation: 0,
                      timeReserwation: 0,
                      fullDate: actualDate,
                      hasCommuniting: true,
                      isDeleted: false,
                    });
                  }
                  const newCommuniting = new Communiting({
                    userId: !!resultToUser ? resultToUser._id : null,
                    companyId: companyData._id,
                    workerUserId: hasPermission ? workerUserId : userId,
                    description: description,
                    cost: cost,
                    statusValue: statusValue,
                    dateStartValid: statusValue >= 1 ? new Date() : null,
                    dateCommunitingValid: statusValue >= 2 ? new Date() : null,
                    dateEndValid: statusValue >= 3 ? new Date() : null,
                    month: actualDate.getMonth() + 1,
                    year: actualDate.getFullYear(),
                    day: actualDate.getDate(),
                    timeStart: timeStart,
                    timeEnd: timeEnd,
                    fullDate: actualDate,
                    city: cityInput,
                    street: streetInput,
                    reserwationId: !!newReserwationWorker
                      ? newReserwationWorker._id
                      : null,
                  });
                  if (!!newReserwationWorker) {
                    newReserwationWorker.communitingId = newCommuniting._id;
                    newReserwationWorker.save();
                  }
                  return newCommuniting.save();
                } else {
                  const error = new Error("Użytkownik pracuje w działalności");
                  error.statusCode = 441;
                  throw error;
                }
              } else {
                const error = new Error("Brak użytkownika");
                error.statusCode = 440;
                throw error;
              }
            } else {
              const hashedName = Buffer.from(name.toString(), "utf-8").toString(
                "base64"
              );
              const hashedSurname = Buffer.from(
                surname.toString(),
                "utf-8"
              ).toString("base64");

              if (!!resultToUser) {
                let userIsInWorkersInCompany = companyData.owner == userId;
                if (!!resultToUser) {
                  if (!userIsInWorkersInCompany) {
                    userIsInWorkersInCompany = companyData.workers.some(
                      (worker) => {
                        return worker.user == resultToUser._id;
                      }
                    );
                  }
                }
                if (userIsInWorkersInCompany) {
                  const error = new Error("Użytkownik pracuje w działalności");
                  error.statusCode = 441;
                  throw error;
                }
              }

              if (addWorkerTime) {
                newReserwationWorker = new Reserwation({
                  fromUser: userId,
                  toWorkerUserId: workerUserId,
                  company: companyId,
                  dateStart: timeStart,
                  dateEnd: timeEnd,
                  costReserwation: null,
                  timeReserwation: null,
                  visitNotFinished: false,
                  visitCanceled: false,
                  visitChanged: false,
                  workerReserwation: true,
                  dateYear: Number(arrayDateFull[2]),
                  dateMonth: Number(arrayDateFull[1]),
                  dateDay: Number(arrayDateFull[0]),
                  reserwationMessage: ``,
                  costReserwation: 0,
                  timeReserwation: 0,
                  fullDate: actualDate,
                  hasCommuniting: true,
                  isDeleted: false,
                });
              }

              const newCommuniting = new Communiting({
                userId: !!resultToUser ? resultToUser._id : null,
                companyId: companyData._id,
                workerUserId: hasPermission ? workerUserId : userId,
                name: hashedName,
                surname: hashedSurname,
                email: !!email ? email : null,
                phone: hashedPhoneNumber,
                description: description,
                cost: cost,
                statusValue: statusValue,
                dateStartValid: statusValue >= 1 ? new Date() : null,
                dateCommunitingValid: statusValue >= 2 ? new Date() : null,
                dateEndValid: statusValue >= 3 ? new Date() : null,
                month: actualDate.getMonth() + 1,
                year: actualDate.getFullYear(),
                day: actualDate.getDate(),
                timeStart: timeStart,
                timeEnd: timeEnd,
                city: cityInput,
                street: streetInput,
                fullDate: actualDate,
                reserwationId: !!newReserwationWorker
                  ? newReserwationWorker._id
                  : null,
              });
              if (!!newReserwationWorker) {
                newReserwationWorker.communitingId = newCommuniting._id;
                newReserwationWorker.save();
              }
              return newCommuniting.save();
            }
          });
      } else {
        const error = new Error("Brak firmy");
        error.statusCode = 422;
        throw error;
      }
    })
    .then((resultSaveCommuniting) => {
      return CompanyUsersInformations.findOne({
        userId: userId,
        companyId: companyId,
      }).then((resultCompanyUsersInformations) => {
        if (!!!resultCompanyUsersInformations) {
          const newUserCompanyInfo = new CompanyUsersInformations({
            userId: userId,
            companyId: companyId,
            messages: [],
          });
          newUserCompanyInfo.save();
        }
        return resultSaveCommuniting;
      });
    })
    .then((resultSaveCommuniting) => {
      return resultSaveCommuniting
        .populate({
          path: "companyId",
          select: "_id linkPath name",
        })
        .populate(
          {
            path: "userId workerUserId",
            select: "name surname _id",
          },
          async function (err, populateCommuniting) {
            const emailContent = `Utworzono dojazd dnia: ${
              populateCommuniting.day < 10
                ? `0${populateCommuniting.day}`
                : populateCommuniting.day
            }-${
              populateCommuniting.month < 10
                ? `0${populateCommuniting.month}`
                : populateCommuniting.month
            }-${populateCommuniting.year}, miasto: ${
              populateCommuniting.city
            }, ulica: ${populateCommuniting.street} przewidywany koszt: ${
              !!populateCommuniting.cost ? populateCommuniting.cost : "nieznany"
            }, numer dojazdu: ${populateCommuniting._id}`;

            const payload = {
              title: `Utworzono dojazd dnia: ${
                populateCommuniting.day < 10
                  ? `0${populateCommuniting.day}`
                  : populateCommuniting.day
              }-${
                populateCommuniting.month < 10
                  ? `0${populateCommuniting.month}`
                  : populateCommuniting.month
              }-${populateCommuniting.year}, miasto: ${
                populateCommuniting.city
              }, ulica: ${populateCommuniting.street} przewidywany koszt: ${
                !!populateCommuniting.cost
                  ? populateCommuniting.cost
                  : "nieznany"
              }, numer dojazdu: ${populateCommuniting._id}`,
              body: "this is the body",
              icon: "images/someImageInPath.png",
            };

            const emailSubject = `Dodano dojazd`;
            const message = `Utworzono dojazd dnia: ${
              populateCommuniting.day < 10
                ? `0${populateCommuniting.day}`
                : populateCommuniting.day
            }-${
              populateCommuniting.month < 10
                ? `0${populateCommuniting.month}`
                : populateCommuniting.month
            }-${populateCommuniting.year}, miasto: ${
              populateCommuniting.city
            }, ulica: ${populateCommuniting.street} przewidywany koszt: ${
              !!populateCommuniting.cost ? populateCommuniting.cost : "nieznany"
            }, numer dojazdu: ${populateCommuniting._id}`;
            let customPhone = !!populateCommuniting.phone
              ? populateCommuniting.phone
              : null;
            if (!!customPhone) {
              customPhone = Buffer.from(customPhone, "base64").toString(
                "utf-8"
              );
            }
            const validHasUser = !!populateCommuniting.userId
              ? [
                  populateCommuniting.userId._id,
                  populateCommuniting.workerUserId._id,
                ]
              : [populateCommuniting.workerUserId._id];
            const { resultSMS } = await notifications.sendAll({
              usersId: validHasUser,
              clientId: !!populateCommuniting.userId
                ? populateCommuniting.userId._id
                : null,
              emailContent: {
                customEmail: null,
                emailTitle: emailSubject,
                emailMessage: emailContent,
              },
              notificationContent: {
                typeAlert: "communitingId",
                dateAlert: populateCommuniting,
                typeNotification: "commuting_created",
                payload: payload,
                companyChanged: true,
              },
              smsContent: {
                companyId: companyId,
                customPhone: customPhone,
                companySendSMSValidField: "smsCommunitingCreatedAvaible",
                titleCompanySendSMS: "sms_added_communiting",
                message: message,
              },
            });

            if (!!resultSMS) {
              Communiting.updateOne(
                {
                  _id: populateCommuniting._id,
                },
                {
                  $set: {
                    createdSMS: true,
                  },
                }
              ).then(() => {});
            }
            populateCommuniting.phone = null;
            res.status(200).json({
              newCommuniting: populateCommuniting,
            });
          }
        );
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Brak danego konta firmowego";
      }
      next(err);
    });
};

exports.companyDeleteCommuniting = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const communitingId = req.body.communitingId;
  const reserwationId = req.body.reserwationId;
  const opinionId = req.body.opinionId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
  })
    .select("_id owner workers._id workers.user")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          hasPermission = companyData.workers.some((worker) => {
            return worker.user == userId;
          });
        }
        if (!!hasPermission) {
          if (!!opinionId) {
            Opinion.deleteOne({
              _id: opinionId,
            }).then(() => {});
          }
          if (!!reserwationId) {
            Reserwation.deleteOne({
              _id: reserwationId,
            }).then(() => {});
          }
          return Communiting.findOne({
            _id: communitingId,
          })
            .select(
              "workerUserId companyId userId createdAt description street city timeStart timeEnd day month year"
            )
            .populate("companyId", "name linkPath")
            .populate("workerUserId userId", "name surname")
            .then(async (populateCommuniting) => {
              return Communiting.updateOne(
                {
                  _id: communitingId,
                },
                {
                  $set: {
                    isDeleted: true,
                  },
                }
              ).then(async () => {
                const emailContent = `Usunięto dojazd dnia: ${
                  populateCommuniting.day < 10
                    ? `0${populateCommuniting.day}`
                    : populateCommuniting.day
                }-${
                  populateCommuniting.month < 10
                    ? `0${populateCommuniting.month}`
                    : populateCommuniting.month
                }-${populateCommuniting.year}, miasto: ${
                  populateCommuniting.city
                }, ulica: ${populateCommuniting.street}`;

                const payload = {
                  title: `Usunięto dojazd dnia: ${
                    populateCommuniting.day < 10
                      ? `0${populateCommuniting.day}`
                      : populateCommuniting.day
                  }-${
                    populateCommuniting.month < 10
                      ? `0${populateCommuniting.month}`
                      : populateCommuniting.month
                  }-${populateCommuniting.year}, miasto: ${
                    populateCommuniting.city
                  }, ulica: ${populateCommuniting.street}`,
                  body: "this is the body",
                  icon: "images/someImageInPath.png",
                };

                const emailSubject = `Usunięto dojazd`;
                const message = `Utworzono dojazd dnia: ${
                  populateCommuniting.day < 10
                    ? `0${populateCommuniting.day}`
                    : populateCommuniting.day
                }-${
                  populateCommuniting.month < 10
                    ? `0${populateCommuniting.month}`
                    : populateCommuniting.month
                }-${populateCommuniting.year}, miasto: ${
                  populateCommuniting.city
                }, ulica: ${populateCommuniting.street}`;
                let customPhone = !!populateCommuniting.phone
                  ? populateCommuniting.phone
                  : null;
                if (!!customPhone) {
                  customPhone = Buffer.from(customPhone, "base64").toString(
                    "utf-8"
                  );
                }

                const { resultSMS } = await notifications.sendAll({
                  usersId: [
                    populateCommuniting.userId._id,
                    populateCommuniting.workerUserId._id,
                  ],
                  clientId: populateCommuniting.userId._id,
                  emailContent: {
                    customEmail: null,
                    emailTitle: emailSubject,
                    emailMessage: emailContent,
                  },
                  notificationContent: {
                    typeAlert: "communitingId",
                    dateAlert: populateCommuniting,
                    typeNotification: "commuting_deleted",
                    payload: payload,
                    companyChanged: true,
                  },
                  smsContent: {
                    companyId: companyId,
                    customPhone: customPhone,
                    companySendSMSValidField: "smsCommunitingDeletedAvaible",
                    titleCompanySendSMS: "sms_deleted_communiting",
                    message: message,
                  },
                });

                if (!!resultSMS) {
                  Communiting.updateOne(
                    {
                      _id: populateCommuniting._id,
                    },
                    {
                      $set: {
                        deletedSMS: true,
                      },
                    }
                  ).then(() => {});
                }
                res.status(200).json({
                  message: "Usunieto serwis",
                });
              });
            });
        } else {
          const error = new Error("Brak uprawnień");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error("Brak firmy");
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

exports.companyUpdateCommuniting = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const communitingId = req.body.communitingId;
  const description = req.body.description;
  const cost = req.body.cost;
  const statusValue = req.body.statusValue;
  const selectedWorkerUserId = req.body.selectedWorkerUserId;
  const timeStart = req.body.timeStart;
  const timeEnd = req.body.timeEnd;
  const fullDate = req.body.fullDate;
  const reserwationId = req.body.reserwationId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Company.findOne({
    _id: companyId,
    premium: {
      $gte: new Date().toISOString(),
    },
  })
    .select("_id owner workers._id workers.user workers.permissions")
    .then((companyData) => {
      if (!!companyData) {
        let hasPermission = companyData.owner == userId;
        if (!hasPermission) {
          const selectedWorker = companyData.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 10
            );
          }
        }
        const validPermission = !!hasPermission ? {} : { workerUserId: userId };
        const validDateService =
          statusValue == 2 ? { dateCommunitingValid: new Date() } : {};
        const validDateServiceEnd =
          statusValue == 3 ? { dateEndValid: new Date() } : {};

        const splitFullDate = fullDate.split("-");

        if (statusValue == 4) {
          Reserwation.deleteOne({
            _id: reserwationId,
            company: companyId,
          }).then(() => {});
        } else {
          Reserwation.updateOne(
            {
              _id: reserwationId,
              company: companyId,
            },
            {
              $set: {
                dateYear: Number(splitFullDate[2]),
                dateMonth: Number(splitFullDate[1]),
                dateDay: Number(splitFullDate[0]),
                dateStart: timeStart,
                dateEnd: timeEnd,
              },
            }
          ).then(() => {});
        }
        const splitDateStart = timeStart.split(":");
        const newFullDate = new Date(
          Number(splitFullDate[2]),
          Number(splitFullDate[1]) - 1,
          Number(splitFullDate[0]),
          Number(splitDateStart[0]),
          Number(splitDateStart[1])
        );
        return Communiting.updateOne(
          {
            _id: communitingId,
            companyId: companyId,
            ...validPermission,
          },
          {
            $set: {
              workerUserId: selectedWorkerUserId,
              description: description,
              cost: cost,
              statusValue: statusValue,
              timeStart: timeStart,
              timeEnd: timeEnd,
              day: Number(splitFullDate[0]),
              month: Number(splitFullDate[1]),
              year: Number(splitFullDate[2]),
              ...validDateService,
              ...validDateServiceEnd,
              fullDate: newFullDate,
            },
          }
        ).then(() => {
          return Communiting.findOne({
            _id: communitingId,
            companyId: companyId,
            ...validPermission,
          })
            .select(
              "_id city description userId companyId month year day timeStart timeEnd email workerUserId street cost"
            )
            .populate("companyId userId", "name surname linkPath")
            .then(async (resultSavetCommuniting) => {
              if (!!resultSavetCommuniting) {
                const validTextCommuniting =
                  resultSavetCommuniting.statusValue == 4
                    ? "Odwołano"
                    : "Zaktualizowano";

                const emailContent = `${validTextCommuniting} dojazd dnia: ${
                  resultSavetCommuniting.day < 10
                    ? `0${resultSavetCommuniting.day}`
                    : resultSavetCommuniting.day
                }-${
                  resultSavetCommuniting.month < 10
                    ? `0${resultSavetCommuniting.month}`
                    : resultSavetCommuniting.month
                }-${resultSavetCommuniting.year}, miasto: ${
                  resultSavetCommuniting.city
                }, ulica: ${
                  resultSavetCommuniting.street
                } przewidywany koszt: ${
                  !!resultSavetCommuniting.cost
                    ? resultSavetCommuniting.cost
                    : "nieznany"
                }, numer dojazdu: ${resultSavetCommuniting._id}`;

                const payload = {
                  title: `${validTextCommuniting} dojazd dnia: ${
                    resultSavetCommuniting.day < 10
                      ? `0${resultSavetCommuniting.day}`
                      : resultSavetCommuniting.day
                  }-${
                    resultSavetCommuniting.month < 10
                      ? `0${resultSavetCommuniting.month}`
                      : resultSavetCommuniting.month
                  }-${resultSavetCommuniting.year}, miasto: ${
                    resultSavetCommuniting.city
                  }, ulica: ${
                    resultSavetCommuniting.street
                  } przewidywany koszt: ${
                    !!resultSavetCommuniting.cost
                      ? resultSavetCommuniting.cost
                      : "nieznany"
                  }, numer dojazdu: ${resultSavetCommuniting._id}`,
                  body: "this is the body",
                  icon: "images/someImageInPath.png",
                };

                const emailSubject = `${validTextCommuniting} dojazd`;
                const message = `${validTextCommuniting} dojazd dnia: ${
                  resultSavetCommuniting.day < 10
                    ? `0${resultSavetCommuniting.day}`
                    : resultSavetCommuniting.day
                }-${
                  resultSavetCommuniting.month < 10
                    ? `0${resultSavetCommuniting.month}`
                    : resultSavetCommuniting.month
                }-${resultSavetCommuniting.year}, miasto: ${
                  resultSavetCommuniting.city
                }, ulica: ${
                  resultSavetCommuniting.street
                } przewidywany koszt: ${
                  !!resultSavetCommuniting.cost
                    ? resultSavetCommuniting.cost
                    : "nieznany"
                }, numer dojazdu: ${resultSavetCommuniting._id}`;
                let customPhone = !!resultSavetCommuniting.phone
                  ? resultSavetCommuniting.phone
                  : null;
                if (!!customPhone) {
                  customPhone = Buffer.from(customPhone, "base64").toString(
                    "utf-8"
                  );
                }

                const { resultSMS } = await notifications.sendAll({
                  usersId: [
                    resultSavetCommuniting.userId._id,
                    resultSavetCommuniting.workerUserId._id,
                  ],
                  clientId: resultSavetCommuniting.userId._id,
                  emailContent: {
                    customEmail: null,
                    emailTitle: emailSubject,
                    emailMessage: emailContent,
                  },
                  notificationContent: {
                    typeAlert: "communitingId",
                    dateAlert: resultSavetCommuniting,
                    typeNotification:
                      resultSavetCommuniting.statusValue == 4
                        ? "commuting_canceled"
                        : "commuting_changed",
                    payload: payload,
                    companyChanged: true,
                  },
                  smsContent: {
                    companyId: companyId,
                    customPhone: customPhone,
                    companySendSMSValidField:
                      resultSavetCommuniting.statusValue == 4
                        ? "smsCommunitingCanceledAvaible"
                        : "smsCommunitingChangedAvaible",
                    titleCompanySendSMS:
                      resultSavetCommuniting.statusValue == 4
                        ? "sms_canceld_communiting"
                        : "sms_changed_communiting",
                    message: message,
                  },
                });
                const validUpdateValue =
                  resultSavetCommuniting.statusValue == 4
                    ? { canceledSMS: true }
                    : { changedSMS: true };
                if (!!resultSMS) {
                  Communiting.updateOne(
                    {
                      _id: resultSavetCommuniting._id,
                    },
                    {
                      $set: validUpdateValue,
                    }
                  ).then(() => {});
                }
                res.status(200).json({
                  message: "Zaktualizowano dojazd",
                });
              }
            });
        });
      } else {
        const error = new Error("Brak firmy");
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
