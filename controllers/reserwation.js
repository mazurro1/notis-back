const Reserwation = require("../models/reserwation");
const User = require("../models/user");
const Company = require("../models/company");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const io = require("../socket");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const company = require("../models/company");
const mongoose = require("mongoose");
require("dotenv").config();
const { MAIL_API_KEY } = process.env;
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: MAIL_API_KEY,
    },
  })
);

exports.addReserwation = (req, res, next) => {
  const userId = req.userId;
  const userEmail = req.userEmail;
  const workerId = req.body.workerId;
  const workerUserId = req.body.workerUserId;
  const companyId = req.body.companyId;
  const dateStart = req.body.dateStart;
  const dateFull = req.body.dateFull;
  const reserwationMessage = req.body.reserwationMessage;
  const serviceId = req.body.serviceId;
  const numberPhone = req.body.numberPhone;
  const isStampActive = req.body.isStampActive;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const arrayDateFull = dateFull.split("-");
  const splitDateStart = dateStart.split(":");

  const actualDate = new Date(
    Number(arrayDateFull[2]),
    Number(arrayDateFull[1]) - 1,
    Number(arrayDateFull[0]),
    Number(splitDateStart[0]),
    Number(splitDateStart[1])
  );
  const isGoodTimeDate = actualDate >= new Date();

  Reserwation.find({
    company: companyId,
    toWorkerUserId: workerUserId,
    dateDay: Number(arrayDateFull[0]),
    dateMonth: Number(arrayDateFull[1]),
    dateYear: Number(arrayDateFull[2]),
    visitCanceled: false,
  })
    .then((allReserwations) => {
      return Company.findOne({ _id: companyId })
        .select(
          "openingDays ownerData workers owner daysOff reservationMonthTime services usersInformation promotions happyHoursConst companyStamps"
        )
        .then((companyDoc) => {
          if (!!companyDoc) {
            return User.findOne({
              _id: userId,
            })
              .select("_id stamps")
              .populate(
                "stamps.reserwations",
                "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company visitCanceled"
              )
              .then((resultUserDoc) => {
                if (!!resultUserDoc) {
                  let userIsBlocked = false;
                  const validUserInformation = !!companyDoc.usersInformation
                    ? companyDoc.usersInformation
                    : [];
                  const isUserInUsersInformations = validUserInformation.findIndex(
                    (infUser) => infUser.userId == userId
                  );

                  if (isUserInUsersInformations >= 0) {
                    userIsBlocked =
                      companyDoc.usersInformation[isUserInUsersInformations]
                        .isBlocked;
                  }
                  if (isGoodTimeDate) {
                    if (!!!userIsBlocked) {
                      let selectedWorker = null;
                      if (companyDoc.owner == workerUserId) {
                        selectedWorker = companyDoc.ownerData;
                      } else {
                        selectedWorker = companyDoc.workers.find(
                          (item) => item._id == workerId
                        );
                      }
                      if (!!selectedWorker) {
                        const dateToReserw = new Date(
                          `${arrayDateFull[1]}-${arrayDateFull[0]}-${arrayDateFull[2]}`
                        );
                        const selectedServices = companyDoc.services.find(
                          (serviceItem) => serviceItem._id == serviceId
                        );
                        if (!!selectedServices) {
                          const dayDate = dateToReserw.getDay();
                          const nameOpeningDays =
                            dayDate === 0
                              ? "sun"
                              : dayDate === 1
                              ? "mon"
                              : dayDate === 2
                              ? "tue"
                              : dayDate === 3
                              ? "wed"
                              : dayDate === 4
                              ? "thu"
                              : dayDate === 5
                              ? "fri"
                              : "sat";

                          const disabledWorkerDate = [];
                          let isEmptyDate = true;

                          const arrayDateStartNewReserwation = dateStart.split(
                            ":"
                          );

                          const convertDateStartToMinNewReserwation =
                            Number(arrayDateStartNewReserwation[0]) * 60 +
                            Number(arrayDateStartNewReserwation[1]);

                          const dateEndNewReserwation =
                            convertDateStartToMinNewReserwation +
                            Number(selectedServices.time);
                          //////////////////////////////////////////////////////////////////////////
                          // const selectedOpenTimeDay = companyDoc.openingDays[nameOpeningDays];
                          //////////////////////
                          const selectedDate = new Date(
                            Number(arrayDateFull[2]),
                            Number(arrayDateFull[1]) - 1,
                            Number(arrayDateFull[0]),
                            10,
                            0,
                            0,
                            0
                          );
                          const selectedDateDayOfTheWeek = selectedDate.getDay();
                          const selectedFullDate = `${Number(
                            arrayDateFull[0]
                          )}-${Number(arrayDateFull[1])}-${Number(
                            arrayDateFull[2]
                          )}`;
                          const mapWorkerConstWorkingHours = selectedWorker.constantWorkingHours.map(
                            (item) => {
                              return {
                                _id: item._id,
                                dayOfTheWeek: item.dayOfTheWeek,
                                start: item.startWorking,
                                end: item.endWorking,
                                disabled: item.disabled,
                              };
                            }
                          );

                          const workerConstWorkingHours = mapWorkerConstWorkingHours.find(
                            (item) =>
                              item.dayOfTheWeek === selectedDateDayOfTheWeek
                          );
                          let workerNoConstWorkingHours = selectedWorker.noConstantWorkingHours.find(
                            (item) => item.fullDate == selectedFullDate
                          );

                          if (!!workerNoConstWorkingHours) {
                            const startDate = new Date(
                              workerNoConstWorkingHours.start
                            );
                            const startDateResult = `${startDate.getHours()}:${startDate.getMinutes()}`;
                            const endDate = new Date(
                              workerNoConstWorkingHours.end
                            );
                            const endDateResult = `${endDate.getHours()}:${endDate.getMinutes()}`;
                            const newDateNoConst = {
                              _id: workerNoConstWorkingHours._id,
                              fullDate: workerNoConstWorkingHours.fullDate,
                              holidays: workerNoConstWorkingHours.holidays,
                              start: startDateResult,
                              end: endDateResult,
                            };
                            workerNoConstWorkingHours = newDateNoConst;
                          }
                          const selectedOpenTimeDay = !!workerNoConstWorkingHours
                            ? workerNoConstWorkingHours.holidays
                              ? null
                              : workerNoConstWorkingHours
                            : workerConstWorkingHours;
                          /////////////////////////////////////////////////////////////
                          const splitOpenWorker = selectedOpenTimeDay.start.split(
                            ":"
                          );
                          const splitCloseWorker = selectedOpenTimeDay.end.split(
                            ":"
                          );

                          const convertDateStartWorkWorker =
                            Number(splitOpenWorker[0]) * 60 +
                            Number(splitOpenWorker[1]);

                          const convertDateEndWorkWorker =
                            Number(splitCloseWorker[0]) * 60 +
                            Number(splitCloseWorker[1]);

                          allReserwations.forEach((workerReserwation) => {
                            const arrayDateStart = workerReserwation.dateStart.split(
                              ":"
                            );

                            const convertDateStartToMin =
                              Number(arrayDateStart[0]) * 60 +
                              Number(arrayDateStart[1]);

                            const dateEndSerwer =
                              convertDateStartToMin +
                              Number(workerReserwation.timeReserwation);

                            const newData = {
                              dateStart: convertDateStartToMin,
                              dateEnd: dateEndSerwer,
                            };

                            disabledWorkerDate.push(newData);
                          });

                          disabledWorkerDate.forEach((disabledDateItem) => {
                            const isStartInDate =
                              convertDateStartToMinNewReserwation <
                                disabledDateItem.dateEnd &&
                              convertDateStartToMinNewReserwation >=
                                disabledDateItem.dateStart;

                            const isEndInDate =
                              dateEndNewReserwation <=
                                disabledDateItem.dateEnd &&
                              dateEndNewReserwation >
                                disabledDateItem.dateStart;

                            const isStartLowerAndEndBigger =
                              disabledDateItem.dateStart >=
                                convertDateStartToMinNewReserwation &&
                              disabledDateItem.dateEnd <= dateEndNewReserwation;

                            if (
                              isStartInDate ||
                              isEndInDate ||
                              isStartLowerAndEndBigger
                            ) {
                              isEmptyDate = false;
                            }
                          });

                          const companyIsClose =
                            selectedOpenTimeDay.disabled ||
                            convertDateStartToMinNewReserwation <
                              convertDateStartWorkWorker ||
                            convertDateEndWorkWorker < dateEndNewReserwation;

                          const findOffDay = companyDoc.daysOff.some(
                            (dayOff) =>
                              dayOff.day === Number(arrayDateFull[0]) &&
                              dayOff.month === Number(arrayDateFull[1]) &&
                              dayOff.year === Number(arrayDateFull[2])
                          );

                          // sprawdzanie rezerwacji do przodu
                          let dateToReserwIsGood = true;
                          if (!!companyDoc.reservationMonthTime) {
                            const maxDateToReserw = new Date(
                              new Date().setMonth(
                                new Date().getMonth() +
                                  companyDoc.reservationMonthTime
                              )
                            );
                            dateToReserwIsGood =
                              maxDateToReserw >= selectedDate;
                          }

                          if (dateToReserwIsGood) {
                            if (
                              !!isEmptyDate &&
                              !companyIsClose &&
                              !!!findOffDay
                            ) {
                              let timeEndService = "";
                              if (Number(dateEndNewReserwation) <= 60) {
                                timeEndService = `00:${
                                  dateEndNewReserwation <= 9
                                    ? `0${dateEndNewReserwation}`
                                    : dateEndNewReserwation
                                }`;
                              } else {
                                const numberTime = Number(
                                  dateEndNewReserwation
                                );
                                const numberOfHours = Math.floor(
                                  numberTime / 60
                                );
                                if (Number(dateEndNewReserwation) % 60 === 0) {
                                  timeEndService = `${
                                    numberOfHours <= 9
                                      ? `0${numberOfHours}`
                                      : numberOfHours
                                  }:00`;
                                } else {
                                  const numberOfMinutes =
                                    numberTime - numberOfHours * 60;
                                  timeEndService = `${
                                    numberOfHours <= 9
                                      ? `0${numberOfHours}`
                                      : numberOfHours
                                  }:${
                                    numberOfMinutes <= 9
                                      ? `0${numberOfMinutes}`
                                      : numberOfMinutes
                                  }`;
                                }
                              }

                              const convertToValidDateDateFull = `${Number(
                                arrayDateFull[2]
                              )}-${
                                Number(arrayDateFull[1]) < 10
                                  ? `0${Number(arrayDateFull[1])}`
                                  : Number(arrayDateFull[1])
                              }-${
                                Number(arrayDateFull[0]) < 10
                                  ? `0${Number(arrayDateFull[0])}`
                                  : Number(arrayDateFull[0])
                              }`;
                              const newDateConvertToValidDateDateFull = new Date(
                                convertToValidDateDateFull
                              );

                              const dayNewDateConvertToValidDateDateFull = newDateConvertToValidDateDateFull.getDay();

                              //promotions
                              const filterSelectedPromotions = companyDoc.promotions.filter(
                                (promotionItem) => {
                                  const dateStartPromotion = new Date(
                                    promotionItem.start
                                  );
                                  const dateEndPromotion = new Date(
                                    promotionItem.end
                                  );
                                  const isDayInPromotion =
                                    dateStartPromotion <=
                                      newDateConvertToValidDateDateFull &&
                                    dateEndPromotion >=
                                      newDateConvertToValidDateDateFull;

                                  const isServiceInPromotion = promotionItem.servicesInPromotion.some(
                                    (promotionItemService) =>
                                      promotionItemService ==
                                      selectedServices._id
                                  );
                                  return (
                                    isServiceInPromotion && isDayInPromotion
                                  );
                                }
                              );
                              let promotionNumber = null;

                              if (filterSelectedPromotions.length > 0) {
                                filterSelectedPromotions.sort((a, b) => {
                                  const firstItemToSort = a.promotionPercent;
                                  const secondItemToSort = b.promotionPercent;
                                  if (firstItemToSort < secondItemToSort)
                                    return 1;
                                  if (firstItemToSort > secondItemToSort)
                                    return -1;
                                  return 0;
                                });
                                promotionNumber =
                                  filterSelectedPromotions[0].promotionPercent;
                              }

                              //happy hours
                              const filterSelectedHappyHours = companyDoc.happyHoursConst.filter(
                                (happyHourItem) => {
                                  const isSelectedDayHappyHour = happyHourItem.dayWeekIndex.some(
                                    (happyHourItemService) =>
                                      happyHourItemService ===
                                      dayNewDateConvertToValidDateDateFull
                                  );

                                  const isServiceInHappyHour = happyHourItem.servicesInPromotion.some(
                                    (happyHourItemService) =>
                                      happyHourItemService == serviceId
                                  );
                                  const splitDateStart = happyHourItem.start.split(
                                    ":"
                                  );
                                  const splitDateEnd = happyHourItem.end.split(
                                    ":"
                                  );
                                  const dateStartToValid = new Date(
                                    new Date(
                                      newDateConvertToValidDateDateFull.setHours(
                                        Number(splitDateStart[0])
                                      )
                                    ).setMinutes(Number(splitDateStart[1]))
                                  );
                                  const dateEndToValid = new Date(
                                    new Date(
                                      newDateConvertToValidDateDateFull.setHours(
                                        Number(splitDateEnd[0])
                                      )
                                    ).setMinutes(Number(splitDateEnd[1]))
                                  );
                                  const validHappyHourDate =
                                    dateStartToValid <= actualDate &&
                                    actualDate <= dateEndToValid;
                                  return (
                                    isSelectedDayHappyHour &&
                                    isServiceInHappyHour &&
                                    validHappyHourDate
                                  );
                                }
                              );
                              let happyHourNumber = null;
                              if (filterSelectedHappyHours.length > 0) {
                                filterSelectedHappyHours.sort((a, b) => {
                                  const firstItemToSort = a.promotionPercent;
                                  const secondItemToSort = b.promotionPercent;
                                  if (firstItemToSort < secondItemToSort)
                                    return 1;
                                  if (firstItemToSort > secondItemToSort)
                                    return -1;
                                  return 0;
                                });
                                happyHourNumber =
                                  filterSelectedHappyHours[0].promotionPercent;
                              }

                              // promotionNumber; happyHourNumber

                              // promotion in stamp
                              let stampNumber = null;
                              if (
                                !!!promotionNumber &&
                                !!!happyHourNumber &&
                                !!isStampActive
                              ) {
                                const findCompanyStamp = companyDoc.companyStamps.find(
                                  (itemStamp) => {
                                    const isInStampsService = itemStamp.servicesId.some(
                                      (stampService) =>
                                        stampService.toString() ===
                                        serviceId.toString()
                                    );
                                    return isInStampsService;
                                  }
                                );

                                if (!!findCompanyStamp) {
                                  if (!!!findCompanyStamp.disabled) {
                                    const findStampId = resultUserDoc.stamps.findIndex(
                                      (itemStamp) => {
                                        return (
                                          itemStamp.companyId.toString() ===
                                          companyId.toString()
                                        );
                                      }
                                    );

                                    if (findStampId >= 0) {
                                      let numberOfActiveStamps = 0;
                                      resultUserDoc.stamps[
                                        findStampId
                                      ].reserwations.forEach(
                                        (stampReserwation) => {
                                          const splitDateEnd = stampReserwation.dateEnd.split(
                                            ""
                                          );
                                          const reserwationStampDateEnd = new Date(
                                            stampReserwation.dateYear,
                                            stampReserwation.dateMonth,
                                            stampReserwation.dateDay,
                                            Number(splitDateEnd[0]),
                                            Number(splitDateEnd[1])
                                          );

                                          if (
                                            !!!stampReserwation.visitCanceled &&
                                            reserwationStampDateEnd < new Date()
                                          ) {
                                            numberOfActiveStamps =
                                              numberOfActiveStamps + 1;
                                          }
                                        }
                                      );
                                      if (
                                        numberOfActiveStamps > 0 &&
                                        findCompanyStamp.countStampsToActive <=
                                          numberOfActiveStamps
                                      ) {
                                        stampNumber =
                                          findCompanyStamp.promotionPercent;
                                        resultUserDoc.stamps[
                                          findStampId
                                        ].reserwations = [];
                                        resultUserDoc.save();
                                      }
                                    }
                                  }
                                }
                              }

                              const resultPromotion =
                                stampNumber !== null
                                  ? stampNumber
                                  : promotionNumber !== null
                                  ? promotionNumber
                                  : happyHourNumber !== null
                                  ? happyHourNumber
                                  : 0;
                              const resultPriceAfterPromotion = Math.floor(
                                (selectedServices.serviceCost *
                                  (100 - resultPromotion)) /
                                  100
                              );

                              const newReserwation = new Reserwation({
                                fromUser: userId,
                                toWorkerUserId: workerUserId,
                                company: companyId,
                                dateYear: Number(arrayDateFull[2]),
                                dateMonth: Number(arrayDateFull[1]),
                                dateDay: Number(arrayDateFull[0]),
                                dateStart: dateStart,
                                dateEnd: timeEndService,
                                costReserwation: resultPriceAfterPromotion,
                                timeReserwation: selectedServices.time,
                                serviceName: selectedServices.serviceName,
                                visitNotFinished: false,
                                visitCanceled: false,
                                visitChanged: false,
                                extraCost: selectedServices.extraCost,
                                extraTime: selectedServices.extraTime,
                                reserwationMessage: reserwationMessage,
                                workerReserwation: false,
                                serviceId: selectedServices._id,
                                fullDate: actualDate,
                                activePromotion: !!promotionNumber
                                  ? true
                                  : false,
                                activeHappyHour: !!happyHourNumber
                                  ? true
                                  : false,
                                activeStamp: !!stampNumber ? true : false,
                                basicPrice: selectedServices.serviceCost,
                              });

                              //add user to users info and add reserwation to

                              if (isUserInUsersInformations >= 0) {
                                const validReserwationCount = companyDoc
                                  .usersInformation[isUserInUsersInformations]
                                  .reserwationsCount
                                  ? companyDoc.usersInformation[
                                      isUserInUsersInformations
                                    ].reserwationsCount
                                  : 0;
                                companyDoc.usersInformation[
                                  isUserInUsersInformations
                                ].reserwationsCount = validReserwationCount + 1;
                                companyDoc.save();
                              } else {
                                const newUserInfo = {
                                  userId: userId,
                                  isBlocked: false,
                                  reserwationsCount: 1,
                                };
                                companyDoc.usersInformation.push(newUserInfo);
                                companyDoc.save();
                              }

                              return newReserwation.save();
                            } else {
                              const error = new Error(
                                "Podany termin jest zajęty."
                              );
                              error.statusCode = 422;
                              throw error;
                            }
                          } else {
                            const error = new Error(
                              "Brak możliwości rezerwacji w podanym terminie."
                            );
                            error.statusCode = 422;
                            throw error;
                          }
                        } else {
                          const error = new Error("Brak podanej usługi.");
                          error.statusCode = 422;
                          throw error;
                        }
                      } else {
                        const error = new Error("Brak podanego pracownika.");
                        error.statusCode = 422;
                        throw error;
                      }
                    } else {
                      const error = new Error(
                        "Użytkownik został zablokowany do rezerwacji w tej firmie."
                      );
                      error.statusCode = 422;
                      throw error;
                    }
                  } else {
                    const error = new Error(
                      "Nie można dokonywać rezerwacji w tym terminie."
                    );
                    error.statusCode = 422;
                    throw error;
                  }
                } else {
                  const error = new Error("Brak użytkownika.");
                  error.statusCode = 422;
                  throw error;
                }
              });
          } else {
            const error = new Error("Brak firmy.");
            error.statusCode = 422;
            throw error;
          }
        });
    })
    .then((resultReserwation) => {
      return User.find({ _id: { $in: [userId, workerUserId] } })
        .select("_id alerts alertActiveCount stamps")
        .then((allUsers) => {
          if (!!allUsers) {
            allUsers.forEach((userResult) => {
              const newAlertData = {
                reserwationId: resultReserwation._id,
                active: true,
                type: "rezerwation_created",
                creationTime: new Date(),
                companyChanged: false,
              };
              resultReserwation
                .populate(
                  "reserwationId",
                  "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company"
                )
                .populate(
                  {
                    path: "company fromUser",
                    select: "name surname linkPath",
                  },
                  function (err, resultReserwationPopulate) {
                    io.getIO().emit(`user${userResult._id}`, {
                      action: "update-alerts",
                      alertData: {
                        reserwationId: resultReserwationPopulate,
                        active: true,
                        type: "rezerwation_created",
                        creationTime: new Date(),
                        companyChanged: false,
                      },
                    });
                  }
                );
              if (!!numberPhone) {
                const hashedPhoneNumber = Buffer.from(
                  numberPhone,
                  "utf-8"
                ).toString("base64");
                userResult.hasPhone = true;
                userResult.phone = hashedPhoneNumber;
              }
              userResult.alerts.unshift(newAlertData);
              const countAlertsActiveValid = !!userResult.alertActiveCount
                ? userResult.alertActiveCount
                : 0;
              userResult.alertActiveCount = countAlertsActiveValid + 1;

              //add active stamps to user
              if (
                !!!resultReserwation.activePromotion &&
                !!!resultReserwation.activeHappyHour &&
                !!!resultReserwation.activeStamp &&
                userResult._id.toString() ===
                  resultReserwation.fromUser.toString()
              ) {
                return Company.findOne({ _id: companyId })
                  .select("_id companyStamps")
                  .then((companyDoc) => {
                    if (!!companyDoc) {
                      const findCompanyStamp = companyDoc.companyStamps.find(
                        (itemStamp) => {
                          const isInStampsService = itemStamp.servicesId.some(
                            (stampService) =>
                              stampService.toString() === serviceId.toString()
                          );
                          return isInStampsService;
                        }
                      );
                      if (!!findCompanyStamp) {
                        if (!!!findCompanyStamp.disabled) {
                          const findStampId = userResult.stamps.findIndex(
                            (itemStamp) => {
                              return (
                                itemStamp.companyId.toString() ===
                                resultReserwation.company._id.toString()
                              );
                            }
                          );

                          if (findStampId >= 0) {
                            userResult.stamps[findStampId].reserwations.push(
                              resultReserwation._id
                            );
                          } else {
                            const newStamp = {
                              companyId: resultReserwation.company,
                              reserwations: [resultReserwation._id],
                            };
                            userResult.stamps.push(newStamp);
                          }
                          userResult.save();
                        }
                      }
                    } else {
                      const error = new Error(
                        "Błąd podczas dodawania pieczątki."
                      );
                      error.statusCode = 422;
                      throw error;
                    }
                  });
              }

              return userResult.save();
            });

            // transporter.sendMail({
            //   to: userEmail,
            //   from: "nootis.help@gmail.com",
            //   subject: `Dokonano rezerwacji w firmie ${result.company.name}`,
            //   html: `<h1>Termin rezerwacji:</h1>
            //   <h4>
            //     Nazwa usługi: ${result.serviceName}
            //   </h4>
            //   <h4>
            //     Termin: ${result.dateDay}-${result.dateMonth}-${result.dateYear}
            //   </h4>
            //   <h4>
            //     Godzina: ${result.dateStart}
            //   </h4>
            //   <h4>
            //     Czas trwania: ${result.timeReserwation}min ${
            //     result.extraTime ? "+" : ""
            //   }
            //   </h4>
            //   <h4>
            //     Koszt: ${result.costReserwation} zł ${result.extraCost ? "+" : ""}
            //   </h4>
            //   `,
            // });
          }
          // else {
          //   const error = new Error("Brak podanej usługi.");
          //   error.statusCode = 422;
          //   throw error;
          // }
        });
    })
    .then(() => {
      CompanyUsersInformations.findOne({
        userId: userId,
        companyId: companyId,
      }).then((resultCompanyUsersInformations) => {
        if (!!!resultCompanyUsersInformations) {
          const newUserCompanyInfo = new CompanyUsersInformations({
            userId: userId,
            companyId: companyId,
            messages: [],
          });
          return newUserCompanyInfo.save();
        } else {
          return true;
        }
      });
    })
    .then(() => {
      res.status(201).json({
        message: "Dokonano rezerwacji!",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas składania rezerwacji.";
      }
      next(err);
    });
};

exports.addReserwationWorker = (req, res, next) => {
  const userId = req.userId;
  const workerUserId = req.body.workerUserId;
  const companyId = req.body.companyId;
  const dateStart = req.body.dateStart;
  const dateEnd = req.body.dateEnd;
  const dateFull = req.body.dateFull;
  const reserwationMessage = req.body.reserwationMessage;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const arrayDateFull = dateFull.split("-");
  const splitDateStart = dateStart.split(":");

  const actualDate = new Date(
    Number(arrayDateFull[2]),
    Number(arrayDateFull[1]) - 1,
    Number(arrayDateFull[0]),
    Number(splitDateStart[0]),
    Number(splitDateStart[1])
  );

  Reserwation.find({
    company: companyId,
    toWorkerUserId: workerUserId,
    dateDay: Number(arrayDateFull[0]),
    dateMonth: Number(arrayDateFull[1]),
    dateYear: Number(arrayDateFull[2]),
    visitCanceled: false,
  })
    .then(() => {
      const newReserwationWorker = new Reserwation({
        fromUser: userId,
        toWorkerUserId: workerUserId,
        company: companyId,
        dateYear: Number(arrayDateFull[2]),
        dateMonth: Number(arrayDateFull[1]),
        dateDay: Number(arrayDateFull[0]),
        dateStart: dateStart,
        dateEnd: dateEnd,
        costReserwation: null,
        timeReserwation: null,
        visitNotFinished: false,
        visitCanceled: false,
        visitChanged: false,
        workerReserwation: true,
        reserwationMessage: reserwationMessage,
        costReserwation: 0,
        timeReserwation: 0,
        fullDate: actualDate,
      });

      return newReserwationWorker.save();
    })
    .then(() => {
      res.status(201).json({
        message: "Dokonano rezerwację czasu!",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas składania rezerwacji czasu.";
      }
      next(err);
    });
};

exports.getWorkerDisabledHours = (req, res, next) => {
  const companyId = req.body.companyId;
  const workerUserId = req.body.workerUserId;
  const workerId = req.body.workerId;
  const selectedDay = req.body.selectedDay;
  const selectedMonth = req.body.selectedMonth;
  const selectedYear = req.body.selectedYear;
  const timeReserwation = req.body.timeReserwation;
  const serviceId = req.body.serviceId;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.find({
    company: companyId,
    toWorkerUserId: workerUserId,
    dateMonth: selectedMonth,
    dateDay: selectedDay,
    dateYear: selectedYear,
    visitCanceled: false,
  })
    .select(
      "toWorkerUserId company dateYear dateMonth dateDay dateStart dateEnd visitCanceled"
    )
    .then((reserwationDoc) => {
      return Company.findOne({
        _id: companyId,
      })
        .select(
          "workers owner ownerData reservationEveryTime daysOff reservationMonthTime promotions happyHoursConst"
        )
        .then((companyDoc) => {
          let selectedWorker = null;
          if (companyDoc.owner == workerUserId) {
            selectedWorker = companyDoc.ownerData;
          } else {
            selectedWorker = companyDoc.workers.find((item) => {
              return item._id == workerId;
            });
          }
          if (!!selectedWorker) {
            const selectedDate = new Date(
              selectedYear,
              selectedMonth - 1,
              selectedDay,
              10,
              0,
              0,
              0
            );
            const selectedDateDayOfTheWeek = selectedDate.getDay();
            const selectedFullDate = `${selectedDay}-${selectedMonth}-${selectedYear}`;
            const mapWorkerConstWorkingHours = selectedWorker.constantWorkingHours.map(
              (item) => {
                return {
                  _id: item._id,
                  dayOfTheWeek: item.dayOfTheWeek,
                  start: item.startWorking,
                  end: item.endWorking,
                  disabled: item.disabled,
                };
              }
            );

            const workerConstWorkingHours = mapWorkerConstWorkingHours.find(
              (item) => item.dayOfTheWeek === selectedDateDayOfTheWeek
            );
            let workerNoConstWorkingHours = selectedWorker.noConstantWorkingHours.find(
              (item) => item.fullDate == selectedFullDate
            );

            if (!!workerNoConstWorkingHours) {
              const startDate = new Date(workerNoConstWorkingHours.start);
              const startDateResult = `${startDate.getHours()}:${startDate.getMinutes()}`;
              const endDate = new Date(workerNoConstWorkingHours.end);
              const endDateResult = `${endDate.getHours()}:${endDate.getMinutes()}`;
              const newDateNoConst = {
                _id: workerNoConstWorkingHours._id,
                fullDate: workerNoConstWorkingHours.fullDate,
                holidays: workerNoConstWorkingHours.holidays,
                start: startDateResult,
                end: endDateResult,
              };
              workerNoConstWorkingHours = newDateNoConst;
            }
            const selectedDayToValid = !!workerNoConstWorkingHours
              ? workerNoConstWorkingHours.holidays
                ? null
                : workerNoConstWorkingHours
              : workerConstWorkingHours;

            const findOffDay = companyDoc.daysOff.some(
              (dayOff) =>
                dayOff.day === selectedDay &&
                dayOff.month === selectedMonth &&
                dayOff.year === selectedYear
            );

            // sprawdzanie rezerwacji do przodu
            let dateToReserwIsGood = true;
            if (!!companyDoc.reservationMonthTime) {
              const maxDateToReserw = new Date(
                new Date().setMonth(
                  new Date().getMonth() + companyDoc.reservationMonthTime
                )
              );
              dateToReserwIsGood = maxDateToReserw >= selectedDate;
            }

            if (dateToReserwIsGood) {
              if (!!selectedDayToValid && !!!findOffDay) {
                if (!!!selectedDayToValid.disabled) {
                  const workerStartWorkDate = selectedDayToValid.start.split(
                    ":"
                  );
                  const workerEndWorkDate = selectedDayToValid.end.split(":");
                  const workerStartWork =
                    Number(workerStartWorkDate[0]) * 60 +
                    Number(workerStartWorkDate[1]);

                  const workerEndWork =
                    Number(workerEndWorkDate[0]) * 60 +
                    Number(workerEndWorkDate[1]);

                  const timeReservationEveryTime = Number(
                    companyDoc.reservationEveryTime
                  );

                  let avaibleHoursToConvertWithPromotions = [];
                  // pobieranie wszystkich dostępnych godzin dla pracownika

                  // patrzy czy data jest aktualna i jak jest to porównuje dostępne godziny
                  const compareDateActual = new Date(
                    new Date().getFullYear(),
                    new Date().getMonth(),
                    new Date().getDate(),
                    10,
                    0
                  );
                  const compareDateReserwation = new Date(
                    Number(selectedYear),
                    Number(selectedMonth) - 1,
                    Number(selectedDay),
                    10,
                    0
                  );
                  const compareIsActualDay =
                    compareDateActual.getTime() ===
                    compareDateReserwation.getTime();

                  const actualTime = new Date();
                  const actualDateNumber =
                    Number(actualTime.getHours()) * 60 +
                    Number(actualTime.getMinutes());

                  // promotions happyHoursConst serviceId

                  //valid is day in promotion
                  const convertDateReserwationToDateInPromotions = `${compareDateReserwation.getFullYear()}-${
                    compareDateReserwation.getMonth() + 1 < 10
                      ? `0${compareDateReserwation.getMonth() + 1}`
                      : compareDateReserwation.getMonth()
                  }-${
                    compareDateReserwation.getDate() < 10
                      ? `0${compareDateReserwation.getDate()}`
                      : compareDateReserwation.getDate()
                  }`;
                  const dateConvertDateReserwationToDateInPromotions = new Date(
                    convertDateReserwationToDateInPromotions
                  );
                  const filterSelectedPromotions = companyDoc.promotions.filter(
                    (promotionItem) => {
                      const dateStartPromotion = new Date(promotionItem.start);
                      const dateEndPromotion = new Date(promotionItem.end);
                      const isDayInPromotion =
                        dateStartPromotion <=
                          dateConvertDateReserwationToDateInPromotions &&
                        dateEndPromotion >=
                          dateConvertDateReserwationToDateInPromotions;

                      const isServiceInPromotion = promotionItem.servicesInPromotion.some(
                        (promotionItemService) =>
                          promotionItemService == serviceId
                      );
                      return isServiceInPromotion && isDayInPromotion;
                    }
                  );
                  //sort selected promotions
                  let promotionNumber = null;

                  if (filterSelectedPromotions.length > 0) {
                    filterSelectedPromotions.sort((a, b) => {
                      const firstItemToSort = a.promotionPercent;
                      const secondItemToSort = b.promotionPercent;
                      if (firstItemToSort < secondItemToSort) return 1;
                      if (firstItemToSort > secondItemToSort) return -1;
                      return 0;
                    });
                    promotionNumber =
                      filterSelectedPromotions[0].promotionPercent;
                  }
                  //end valid is day in promotion
                  const daysInHappyHours = [];

                  // happyhour promotions valid
                  const selectedReserwationDay = dateConvertDateReserwationToDateInPromotions.getDay();
                  const filterSelectedHappyHours = companyDoc.happyHoursConst.filter(
                    (happyHourItem) => {
                      const isSelectedDayHappyHour = happyHourItem.dayWeekIndex.some(
                        (happyHourItemService) =>
                          happyHourItemService === selectedReserwationDay
                      );
                      const isServiceInHappyHour = happyHourItem.servicesInPromotion.some(
                        (happyHourItemService) =>
                          happyHourItemService == serviceId
                      );
                      return isSelectedDayHappyHour && isServiceInHappyHour;
                    }
                  );
                  if (filterSelectedHappyHours.length > 0) {
                    filterSelectedHappyHours.sort((a, b) => {
                      const firstItemToSort = a.promotionPercent;
                      const secondItemToSort = b.promotionPercent;
                      if (firstItemToSort < secondItemToSort) return -1;
                      if (firstItemToSort > secondItemToSort) return 1;
                      return 0;
                    });
                    filterSelectedHappyHours.forEach((happyHour) => {
                      const dateHappyHourStartSplit = happyHour.start.split(
                        ":"
                      );
                      const dateHappyHourEndSplit = happyHour.end.split(":");
                      const dateStartHappyHourInNumber =
                        Number(dateHappyHourStartSplit[0]) * 60 +
                        Number(dateHappyHourStartSplit[1]);
                      const dateEndHappyHourInNumber =
                        Number(dateHappyHourEndSplit[0]) * 60 +
                        Number(dateHappyHourEndSplit[1]);

                      //added hour with promotion
                      for (
                        let i = dateStartHappyHourInNumber;
                        i >= dateStartHappyHourInNumber &&
                        i <= dateEndHappyHourInNumber;
                        i = i + timeReservationEveryTime
                      ) {
                        const indexDaysInHappyHours = daysInHappyHours.findIndex(
                          (itemHour) => itemHour.time === i
                        );
                        if (indexDaysInHappyHours >= 0) {
                          daysInHappyHours[indexDaysInHappyHours].happyHour =
                            happyHour.promotionPercent;
                        } else {
                          daysInHappyHours.push({
                            time: i,
                            happyHour: happyHour.promotionPercent,
                          });
                        }
                      }
                    });
                  }
                  if (daysInHappyHours.length > 0) {
                    daysInHappyHours.sort((a, b) => {
                      const firstItemToSort = a.time;
                      const secondItemToSort = b.time;
                      if (firstItemToSort < secondItemToSort) return -1;
                      if (firstItemToSort > secondItemToSort) return 1;
                      return 0;
                    });
                  }
                  // console.log(companyDoc.happyHoursConst);

                  for (
                    let i = workerStartWork;
                    i >= workerStartWork &&
                    i <= workerEndWork - timeReserwation;
                    i = i + timeReservationEveryTime
                  ) {
                    // znajduje item w happyhour w promocjach w danych godzinach
                    let happyHourPromotionToTime = null;
                    const findHappyHourPromotionItem = daysInHappyHours.find(
                      (happyHourPromotion) => happyHourPromotion.time === i
                    );
                    if (!!findHappyHourPromotionItem) {
                      happyHourPromotionToTime =
                        findHappyHourPromotionItem.happyHour;
                    }
                    // filtruje dostępne godziny na takie które są aktualne w czasie
                    const newItemTime = {
                      time: i,
                      promotion: promotionNumber,
                      happyHour: happyHourPromotionToTime,
                    };
                    if (compareIsActualDay) {
                      if (i >= actualDateNumber) {
                        avaibleHoursToConvertWithPromotions.push(newItemTime);
                      }
                    } else {
                      avaibleHoursToConvertWithPromotions.push(newItemTime);
                    }
                  }

                  // filtrowanie i konwertowanie tablicy rezerwacji i porównywanie dostępnych godzin dla dat z promocjami
                  avaibleHoursToConvertWithPromotions = avaibleHoursToConvertWithPromotions.filter(
                    (itemAvaible) => {
                      if (reserwationDoc.length > 0) {
                        const isActive = reserwationDoc.some((reserwation) => {
                          const reserwationStartDate = reserwation.dateStart.split(
                            ":"
                          );
                          const reserwationEndDate = reserwation.dateEnd.split(
                            ":"
                          );
                          const reserwationStart =
                            Number(reserwationStartDate[0]) * 60 +
                            Number(reserwationStartDate[1]) -
                            timeReserwation;
                          const reserwationEnd =
                            Number(reserwationEndDate[0]) * 60 +
                            Number(reserwationEndDate[1]);
                          return (
                            itemAvaible.time >= reserwationStart &&
                            itemAvaible.time < reserwationEnd
                          );
                        });
                        return !isActive;
                      } else {
                        return true;
                      }
                    }
                  );

                  // konwertowanie liczb na godziny oraz minuty wraz z promocjami
                  const unConvertAvaibleHoursWithPromotions = avaibleHoursToConvertWithPromotions.map(
                    (item) => {
                      let timeService = "";
                      if (Number(item.time) < 60) {
                        timeService = `0:${item}`;
                      } else {
                        const numberTime = Number(item.time);
                        const numberOfHours = Math.floor(numberTime / 60);
                        if (Number(item.time) % 60 === 0) {
                          timeService = `${numberOfHours}:00`;
                        } else {
                          const numberOfMinutes =
                            numberTime - numberOfHours * 60;
                          timeService = `${numberOfHours}:${
                            numberOfMinutes < 10
                              ? `0${numberOfMinutes}`
                              : numberOfMinutes
                          }`;
                        }
                      }
                      return {
                        time: timeService,
                        promotion: item.promotion,
                        happyHour: item.happyHour,
                      };
                    }
                  );

                  res.status(201).json({
                    avaibleHoursWithPromotions: unConvertAvaibleHoursWithPromotions,
                  });
                } else {
                  const error = new Error("Pracownik ma wolne w podanym dniu.");
                  error.statusCode = 422;
                  throw error;
                }
              } else {
                const error = new Error(
                  "Pracownik nie pracuje w podanym dniu."
                );
                error.statusCode = 422;
                throw error;
              }
            } else {
              const error = new Error(
                "Brak możliwości rezerwacji w podanym terminie."
              );
              error.statusCode = 422;
              throw error;
            }
          } else {
            const error = new Error("Brak podanego pracownika.");
            error.statusCode = 422;
            throw error;
          }
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobieranie dancyh firmy.";
          }
          next(err);
        });
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobieranie zajętych godzin pracownika.";
      }
      next(err);
    });
};

exports.getUserReserwations = (req, res, next) => {
  const userId = req.userId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.find({
    fromUser: userId,
    visitNotFinished: false,
    visitCanceled: false,
    workerReserwation: false,
  })
    .populate("toWorkerUserId", "name surname")
    .populate("company", "name linkPath")
    .populate("opinionId", "")
    .then((reserwationsDoc) => {
      //?
      const otherPropsToReserwation = [];
      const allReserwationsFilter = reserwationsDoc.filter(
        (itemReserwation) => {
          const ifIsInExtraProps = otherPropsToReserwation.some(
            (itemRes) => itemRes.company._id === itemReserwation.company._id
          );
          if (!!!ifIsInExtraProps) {
            if (!!itemReserwation.company) {
              const itemToExtraProps = {
                company: itemReserwation.company,
              };
              otherPropsToReserwation.push(itemToExtraProps);
            }
          }

          const splitDateReserwation = itemReserwation.dateStart.split(":");
          const dateReserwation = new Date(
            itemReserwation.dateYear,
            itemReserwation.dateMonth - 1,
            itemReserwation.dateDay,
            Number(splitDateReserwation[0]),
            Number(splitDateReserwation[1]),
            0
          );
          const actualDate = new Date();
          const isReserwationEnd = actualDate < dateReserwation;
          return (
            !!!itemReserwation.visitCanceled &&
            !!!itemReserwation.visitNotFinished &&
            isReserwationEnd
          );
        }
      );
      //?
      const tempItemsReserwations = allReserwationsFilter.map((item) => {
        return item.company.name;
      });
      let tempReserwationsCategories = new Set(tempItemsReserwations);
      let allReserwationsCategories = Array.from(tempReserwationsCategories);

      let allItems = [];
      allReserwationsCategories.forEach((itemCategory) => {
        const filterItemsToCategory = allReserwationsFilter.filter(
          (item) => item.company.name === itemCategory
        );

        filterItemsToCategory.sort((a, b) => {
          const splitFirstDate = a.dateStart.split(":");
          const splitSecondDate = b.dateStart.split(":");
          const firstDate = new Date(
            a.dateYear,
            a.dateMonth - 1,
            a.dateDay,
            Number(splitFirstDate[0]),
            Number(splitFirstDate[1]),
            0
          );
          const secondDate = new Date(
            b.dateYear,
            b.dateMonth - 1,
            b.dateDay,
            Number(splitSecondDate[0]),
            Number(splitSecondDate[1]),
            0
          );
          if (firstDate < secondDate) return 1;
          if (firstDate > secondDate) return -1;
          return 0;
        });

        const selectedCompany = otherPropsToReserwation.find((itemRes) => {
          if (!!itemRes.company) {
            return itemRes.company.name === itemCategory;
          } else {
            return false;
          }
        });

        const newAllItem = {
          category: itemCategory,
          company: !!selectedCompany ? selectedCompany : null,
          items: filterItemsToCategory,
        };
        allItems.push(newAllItem);
      });

      res.status(201).json({
        reserwations: allItems,
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

exports.getUserReserwationsAll = (req, res, next) => {
  const userId = req.userId;
  const selectedYear = req.body.yearPicker;
  const selectedMonth = req.body.monthPicker;
  const onlyToOpinion = req.body.onlyToOpinion;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const queryToReserwation = onlyToOpinion
    ? {
        fromUser: userId,
        dateYear: selectedYear,
        dateMonth: selectedMonth,
        workerReserwation: false,
        opinionId: null,
      }
    : {
        fromUser: userId,
        dateYear: selectedYear,
        dateMonth: selectedMonth,
        workerReserwation: false,
      };

  Reserwation.find(queryToReserwation)
    .populate("toWorkerUserId", "name surname")
    .populate("company", "name linkPath")
    .populate("opinionId", "")
    .then((reserwationsDoc) => {
      const otherPropsToReserwation = [];
      const tempItemsReserwations = reserwationsDoc.map((item) => {
        const ifIsInExtraProps = otherPropsToReserwation.some(
          (itemRes) => itemRes.company._id === item.company._id
        );
        if (!!!ifIsInExtraProps) {
          if (!!item.company) {
            const itemToExtraProps = {
              company: item.company,
            };
            otherPropsToReserwation.push(itemToExtraProps);
          }
        }
        return item.company.name;
      });

      let tempReserwationsCategories = new Set(tempItemsReserwations);
      let allReserwationsCategories = Array.from(tempReserwationsCategories);

      let allItems = [];
      allReserwationsCategories.forEach((itemCategory) => {
        const filterItemsToCategory = reserwationsDoc.filter(
          (item) => item.company.name === itemCategory
        );

        filterItemsToCategory.sort((a, b) => {
          const splitFirstDate = a.dateStart.split(":");
          const splitSecondDate = b.dateStart.split(":");
          const firstDate = new Date(
            a.dateYear,
            a.dateMonth - 1,
            a.dateDay,
            Number(splitFirstDate[0]),
            Number(splitFirstDate[1]),
            0
          );
          const secondDate = new Date(
            b.dateYear,
            b.dateMonth - 1,
            b.dateDay,
            Number(splitSecondDate[0]),
            Number(splitSecondDate[1]),
            0
          );
          if (firstDate < secondDate) return 1;
          if (firstDate > secondDate) return -1;
          return 0;
        });

        const selectedCompany = otherPropsToReserwation.find((itemRes) => {
          if (!!itemRes.company) {
            return itemRes.company.name === itemCategory;
          } else {
            return false;
          }
        });
        const newAllItem = {
          category: itemCategory,
          company: !!selectedCompany ? selectedCompany : null,
          items: filterItemsToCategory,
        };
        allItems.push(newAllItem);
      });

      res.status(201).json({
        reserwations: allItems,
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

exports.getWorkerReserwationsAll = (req, res, next) => {
  const userId = req.userId;
  const workerUserId = req.body.workerUserId;
  const selectedYear = req.body.yearPicker;
  const selectedMonth = req.body.monthPicker;
  const companyId = req.body.companyId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.find({
    toWorkerUserId: workerUserId,
    dateYear: selectedYear,
    dateMonth: selectedMonth,
    company: companyId,
    visitCanceled: false,
  })
    .populate("fromUser", "name surname")
    .populate("company", "name linkPath services.serviceColor services._id")
    .then((reserwationsDoc) => {
      return Company.findOne({ _id: companyId })
        .select(
          "openingDays daysOff reservationMonthTime reservationEveryTime owner workers.user"
        )
        .populate("workers.user", "_id name surname")
        .then((resultCompany) => {
          if (!!resultCompany) {
            let isActiveWorker = userId == resultCompany.owner;
            if (!!!isActiveWorker) {
              const isWorkerInWorkers = resultCompany.workers.some(
                (worker) => worker.user._id == userId
              );
              isActiveWorker = isWorkerInWorkers;
            }

            if (isActiveWorker) {
              res.status(201).json({
                reserwations: {
                  reserwations: reserwationsDoc,
                  company: resultCompany,
                },
              });
            } else {
              const error = new Error("Brak uprawnień.");
              error.statusCode = 401;
              throw error;
            }
          } else {
            const error = new Error("Brak podanej firmy.");
            error.statusCode = 422;
            throw error;
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

exports.updateReserwation = (req, res, next) => {
  const userId = req.userId;
  const reserwationId = req.body.reserwationId;
  const canceled = req.body.canceled;
  const changed = req.body.changed;
  const noFinished = req.body.noFinished;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.findOne({
    fromUser: userId,
    _id: reserwationId,
    visitCanceled: false,
    visitNotFinished: false,
  })
    .populate("toWorkerUserId", "name surname")
    .populate("company", "name")
    .then((reserwationsDoc) => {
      if (!!reserwationsDoc) {
        const dateEndSplit = reserwationsDoc.dateEnd.split(":");
        const reserwationDate = new Date(
          reserwationsDoc.dateYear,
          reserwationsDoc.dateMonth - 1,
          reserwationsDoc.dateDay,
          Number(dateEndSplit[0]),
          Number(dateEndSplit[1])
        );
        const isGoodDate = new Date() <= reserwationDate;
        if (isGoodDate) {
          if (canceled !== null) {
            reserwationsDoc.visitCanceled = canceled;
          }
          if (changed !== null) {
            reserwationsDoc.visitChanged = changed;
          }
          if (noFinished !== null) {
            reserwationsDoc.visitNotFinished = noFinished;
          }
          return reserwationsDoc.save();
        } else {
          const error = new Error(
            "Brak uprawnień - nie można edytować rezerwacji już skończonej."
          );
          error.statusCode = 401;
          throw error;
        }
      } else {
        const error = new Error("Nie znaleziono podanej rezerwacji.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then((resultReserwation) => {
      return User.find({
        _id: { $in: [userId, resultReserwation.toWorkerUserId._id] },
      })
        .select("_id alerts alertActiveCount")
        .then((allUsers) => {
          if (!!allUsers) {
            const reserwationStatus = resultReserwation.visitCanceled
              ? "rezerwation_canceled"
              : resultReserwation.visitChanged
              ? "rezerwation_changed"
              : resultReserwation.visitNotFinished
              ? "reserwation_not_finished"
              : "reserwation_finished";

            allUsers.forEach((userResult) => {
              const newAlertData = {
                reserwationId: resultReserwation._id,
                active: true,
                type: reserwationStatus,
                creationTime: new Date(),
                companyChanged: false,
              };
              resultReserwation
                .populate(
                  "reserwationId",
                  "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company"
                )
                .populate(
                  {
                    path: "company fromUser",
                    select: "name surname linkPath",
                  },
                  function (err, resultReserwationPopulate) {
                    io.getIO().emit(`user${userResult._id}`, {
                      action: "update-alerts",
                      alertData: {
                        reserwationId: resultReserwationPopulate,
                        active: true,
                        type: reserwationStatus,
                        creationTime: new Date(),
                        companyChanged: false,
                      },
                    });
                  }
                );

              userResult.alerts.unshift(newAlertData);
              const countAlertsActiveValid = !!userResult.alertActiveCount
                ? userResult.alertActiveCount
                : 0;
              userResult.alertActiveCount = countAlertsActiveValid + 1;
              return userResult.save();
            });

            // transporter.sendMail({
            //   to: userEmail,
            //   from: "nootis.help@gmail.com",
            //   subject: `Dokonano rezerwacji w firmie ${result.company.name}`,
            //   html: `<h1>Termin rezerwacji:</h1>
            //   <h4>
            //     Nazwa usługi: ${result.serviceName}
            //   </h4>
            //   <h4>
            //     Termin: ${result.dateDay}-${result.dateMonth}-${result.dateYear}
            //   </h4>
            //   <h4>
            //     Godzina: ${result.dateStart}
            //   </h4>
            //   <h4>
            //     Czas trwania: ${result.timeReserwation}min ${
            //     result.extraTime ? "+" : ""
            //   }
            //   </h4>
            //   <h4>
            //     Koszt: ${result.costReserwation} zł ${result.extraCost ? "+" : ""}
            //   </h4>
            //   `,
            // });

            res.status(201).json({
              reserwation: resultReserwation,
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

exports.updateWorkerReserwation = (req, res, next) => {
  const userId = req.userId;
  const workerUserId = req.body.workerUserId;
  const reserwationId = req.body.reserwationId;
  const canceled = req.body.canceled;
  const changed = req.body.changed;
  const noFinished = req.body.noFinished;
  const newTimeStart = req.body.newTimeStart;
  const newTimeEnd = req.body.newTimeEnd;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.findOne({
    toWorkerUserId: workerUserId,
    _id: reserwationId,
  })
    .populate("toWorkerUserId", "name surname")
    .populate("company", "name owner workers.user")

    .then((reserwationsDoc) => {
      if (!!reserwationsDoc) {
        const dateEndSplit = reserwationsDoc.dateEnd.split(":");
        const reserwationDate = new Date(
          reserwationsDoc.dateYear,
          reserwationsDoc.dateMonth - 1,
          reserwationsDoc.dateDay,
          Number(dateEndSplit[0]),
          Number(dateEndSplit[1])
        );
        // const isGoodDate = new Date() <= reserwationDate;
        const isGoodDate = true;

        if (isGoodDate) {
          let isActiveWorker = userId == reserwationsDoc.company.owner;
          if (!!!isActiveWorker) {
            const isWorkerInWorkers = reserwationsDoc.company.workers.some(
              (worker) => worker.user == userId
            );
            isActiveWorker = isWorkerInWorkers;
          }
          if (isActiveWorker) {
            if (!!newTimeStart) {
              reserwationsDoc.dateStart = newTimeStart;
            }
            if (!!newTimeEnd) {
              reserwationsDoc.dateEnd = newTimeEnd;
            }
            if (canceled !== null) {
              reserwationsDoc.visitCanceled = canceled;
            }
            if (changed !== null) {
              reserwationsDoc.visitChanged = changed;
            }
            if (noFinished !== null) {
              reserwationsDoc.visitNotFinished = noFinished;
            }
            return reserwationsDoc.save();
          } else {
            const error = new Error("Brak uprawnień.");
            error.statusCode = 401;
            throw error;
          }
        } else {
          const error = new Error(
            "Brak uprawnień - nie można edytować rezerwacji już skończonej."
          );
          error.statusCode = 401;
          throw error;
        }
      } else {
        const error = new Error("Nie znaleziono podanej rezerwacji.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then((resultReserwation) => {
      return User.find({
        _id: { $in: [resultReserwation.fromUser, workerUserId] },
      })
        .select("_id alerts alertActiveCount")
        .then((allUsers) => {
          if (!!allUsers) {
            const reserwationStatus = resultReserwation.visitCanceled
              ? "rezerwation_canceled"
              : resultReserwation.visitChanged
              ? "rezerwation_changed"
              : resultReserwation.visitNotFinished
              ? "reserwation_not_finished"
              : "reserwation_finished";
            allUsers.forEach((userResult) => {
              const newAlertData = {
                reserwationId: resultReserwation._id,
                active: true,
                type: reserwationStatus,
                creationTime: new Date(),
                companyChanged: true,
              };
              resultReserwation
                .populate(
                  "reserwationId",
                  "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company"
                )
                .populate(
                  {
                    path: "company fromUser",
                    select: "name surname linkPath",
                  },
                  function (err, resultReserwationPopulate) {
                    io.getIO().emit(`user${userResult._id}`, {
                      action: "update-alerts",
                      alertData: {
                        reserwationId: resultReserwationPopulate,
                        active: true,
                        type: reserwationStatus,
                        creationTime: new Date(),
                        companyChanged: true,
                      },
                    });
                  }
                );

              userResult.alerts.unshift(newAlertData);
              const countAlertsActiveValid = !!userResult.alertActiveCount
                ? userResult.alertActiveCount
                : 0;
              userResult.alertActiveCount = countAlertsActiveValid + 1;
              return userResult.save();
            });

            // transporter.sendMail({
            //   to: userEmail,
            //   from: "nootis.help@gmail.com",
            //   subject: `Dokonano rezerwacji w firmie ${result.company.name}`,
            //   html: `<h1>Termin rezerwacji:</h1>
            //   <h4>
            //     Nazwa usługi: ${result.serviceName}
            //   </h4>
            //   <h4>
            //     Termin: ${result.dateDay}-${result.dateMonth}-${result.dateYear}
            //   </h4>
            //   <h4>
            //     Godzina: ${result.dateStart}
            //   </h4>
            //   <h4>
            //     Czas trwania: ${result.timeReserwation}min ${
            //     result.extraTime ? "+" : ""
            //   }
            //   </h4>
            //   <h4>
            //     Koszt: ${result.costReserwation} zł ${result.extraCost ? "+" : ""}
            //   </h4>
            //   `,
            // });

            res.status(201).json({
              reserwation: resultReserwation,
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

exports.getCompanyReserwations = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.find({
    company: companyId,
  })
    .populate("fromUser", "name surname")
    .select("company fromUser")
    .then((reserwationsDoc) => {
      return Company.findOne({ _id: companyId })
        .populate("workers.user", "_id name surname")
        .select(
          "owner workers.permission workers._id workers.user usersInformation _id"
        )
        .then((resultCompany) => {
          if (!!resultCompany) {
            let isActiveWorker = userId == resultCompany.owner;
            if (!!!isActiveWorker) {
              const isWorkerInWorkers = resultCompany.workers.some(
                (worker) => worker.user._id == userId
              );
              isActiveWorker = isWorkerInWorkers;
            }

            if (isActiveWorker) {
              const arrayWithUsersReserwations = [];
              reserwationsDoc.forEach((reserwation) => {
                if (!!reserwation.fromUser) {
                  const findIndexInArray = arrayWithUsersReserwations.findIndex(
                    (findUser) =>
                      findUser.userId._id == reserwation.fromUser._id
                  );
                  if (findIndexInArray < 0) {
                    const newItemResUser = {
                      userId: reserwation.fromUser,
                      isBlocked: false,
                      reserwationsCount: 0,
                      informations: null,
                      reserwations: null,
                    };
                    arrayWithUsersReserwations.push(newItemResUser);
                  }
                }
              });
              resultCompany.usersInformation.forEach((companyUserInfo) => {
                const findIndexInReserwations = arrayWithUsersReserwations.findIndex(
                  (findUser) => {
                    return (
                      companyUserInfo.userId.toString() ==
                      findUser.userId._id.toString()
                    );
                  }
                );
                if (findIndexInReserwations >= 0) {
                  arrayWithUsersReserwations[
                    findIndexInReserwations
                  ].isBlocked = companyUserInfo.isBlocked;
                  arrayWithUsersReserwations[
                    findIndexInReserwations
                  ].reserwationsCount = companyUserInfo.reserwationsCount;
                }
              });

              return arrayWithUsersReserwations;
            } else {
              const error = new Error("Brak uprawnień.");
              error.statusCode = 401;
              throw error;
            }
          } else {
            const error = new Error("Brak podanej firmy.");
            error.statusCode = 422;
            throw error;
          }
        });
    })
    .then((resultUsers) => {
      res.status(201).json({
        reserwations: resultUsers,
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

exports.getSelectedUserReserwations = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const userSelectedId = req.body.userSelectedId;
  const page = req.body.page;

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
              (perm) => perm === 6
            );
          }
        }
        if (!!hasPermission) {
          return hasPermission;
        } else {
          const error = new Error("Brak uprawnień.");
          error.statusCode = 403;
          throw error;
        }
      } else {
        const error = new Error("Brak wybranej firmy.");
        error.statusCode = 403;
        throw error;
      }
    })
    .then(() => {
      Reserwation.aggregate([
        {
          $match: {
            company: mongoose.Types.ObjectId(companyId),
            fromUser: mongoose.Types.ObjectId(userSelectedId),
            workerReserwation: false,
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
          $sort: { fullDate: -1 },
        },
        { $skip: (page - 1) * 10 },
        { $limit: 10 },
        {
          $project: {
            _id: 1,
            fromUser: 1,
            company: 1,
            toWorkerUserId: {
              name: 1,
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
        .then((resultCompanyUserReserwations) => {
          res.status(200).json({
            reserwations: resultCompanyUserReserwations
              ? resultCompanyUserReserwations
              : [],
          });
        })
        .catch((error) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych firmowych.";
          }
          next(err);
        });
    });
};
