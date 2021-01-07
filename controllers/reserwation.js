const Reserwation = require("../models/reserwation");
const User = require("../models/user");
const Company = require("../models/company");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator/check");
const jwt = require("jsonwebtoken");
const io = require("../socket");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const company = require("../models/company");
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        "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",
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

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const arrayDateFull = dateFull.split("-");

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
          "openingDays ownerData workers owner daysOff reservationMonthTime services usersInformation.isBlocked usersInformation.userId usersInformation.allUserReserwations usersInformation.reserwationsCount"
        )
        .then((companyDoc) => {
          let userIsBlocked = false
          const validUserInformation = !!companyDoc.usersInformation
            ? companyDoc.usersInformation
            : [];
          const isUserInUsersInformations = validUserInformation.findIndex(
            (infUser) => infUser.userId == userId
          );
          
          if (isUserInUsersInformations >= 0){
            userIsBlocked =
              companyDoc.usersInformation[isUserInUsersInformations].isBlocked;
          }
          
          if(!!!userIsBlocked){
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

                const arrayDateStartNewReserwation = dateStart.split(":");

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
                const selectedFullDate = `${Number(arrayDateFull[0])}-${Number(
                  arrayDateFull[1]
                )}-${Number(arrayDateFull[2])}`;
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
                const selectedOpenTimeDay = !!workerNoConstWorkingHours
                  ? workerNoConstWorkingHours.holidays
                    ? null
                    : workerNoConstWorkingHours
                  : workerConstWorkingHours;
                /////////////////////////////////////////////////////////////
                const splitOpenWorker = selectedOpenTimeDay.start.split(":");
                const splitCloseWorker = selectedOpenTimeDay.end.split(":");

                const convertDateStartWorkWorker =
                  Number(splitOpenWorker[0]) * 60 + Number(splitOpenWorker[1]);

                const convertDateEndWorkWorker =
                  Number(splitCloseWorker[0]) * 60 +
                  Number(splitCloseWorker[1]);

                allReserwations.forEach((workerReserwation) => {
                  const arrayDateStart = workerReserwation.dateStart.split(":");

                  const convertDateStartToMin =
                    Number(arrayDateStart[0]) * 60 + Number(arrayDateStart[1]);

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
                    dateEndNewReserwation <= disabledDateItem.dateEnd &&
                    dateEndNewReserwation > disabledDateItem.dateStart;

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
                      new Date().getMonth() + companyDoc.reservationMonthTime
                    )
                  );
                  dateToReserwIsGood = maxDateToReserw >= selectedDate;
                }

                if (dateToReserwIsGood) {
                  if (!!isEmptyDate && !companyIsClose && !!!findOffDay) {
                    let timeEndService = "";
                    if (Number(dateEndNewReserwation) <= 60) {
                      timeEndService = `00:${
                        dateEndNewReserwation <= 9
                          ? `0${dateEndNewReserwation}`
                          : dateEndNewReserwation
                      }`;
                    } else {
                      const numberTime = Number(dateEndNewReserwation);
                      const numberOfHours = Math.floor(numberTime / 60);
                      if (Number(dateEndNewReserwation) % 60 === 0) {
                        timeEndService = `${
                          numberOfHours <= 9
                            ? `0${numberOfHours}`
                            : numberOfHours
                        }:00`;
                      } else {
                        const numberOfMinutes = numberTime - numberOfHours * 60;
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

                    const newReserwation = new Reserwation({
                      fromUser: userId,
                      toWorkerUserId: workerUserId,
                      company: companyId,
                      dateYear: Number(arrayDateFull[2]),
                      dateMonth: Number(arrayDateFull[1]),
                      dateDay: Number(arrayDateFull[0]),
                      dateStart: dateStart,
                      dateEnd: timeEndService,
                      costReserwation: selectedServices.serviceCost,
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
                    });

                    //add user to users info and add reserwation to

                    if (isUserInUsersInformations >= 0) {
                      companyDoc.usersInformation[
                        isUserInUsersInformations
                      ].allUserReserwations.push({
                        reserwationId: newReserwation._id,
                      });

                      companyDoc.usersInformation[
                        isUserInUsersInformations
                      ].reserwationsCount =
                        companyDoc.usersInformation[isUserInUsersInformations]
                          .reserwationsCount + 1;
                      companyDoc.save();
                    } else {
                      const newUserInfo = {
                        userId: userId,
                        isBlocked: false,
                        reserwationsCount: 1,
                        allUserReserwations: [
                          {
                            reserwationId: newReserwation._id,
                          },
                        ],
                      };
                      companyDoc.usersInformation.push(newUserInfo);
                      companyDoc.save();
                    }

                    return newReserwation.save();
                  } else {
                    const error = new Error("Podany termin jest zajęty.");
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
          }else{
            const error = new Error("Użytkownik został zablokowany do rezerwacji w tej firmie.");
            error.statusCode = 422;
            throw error;
          }
        });
    })
    .then((resultReserwation) => {
      return User.find({ _id: { $in: [userId, workerUserId] } })
        .select("_id alerts alertActiveCount")
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

              userResult.alerts.unshift(newAlertData);
              const countAlertsActiveValid = !!userResult.alertActiveCount ? userResult.alertActiveCount : 0
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

            
          }
          // else {
          //   const error = new Error("Brak podanej usługi.");
          //   error.statusCode = 422;
          //   throw error;
          // }
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
          "workers owner ownerData reservationEveryTime daysOff reservationMonthTime"
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

                  let avaibleHoursToConvert = [];
                  // pobieranie wszystkich dostępnych godzin dla pracownika
                  for (
                    let i = workerStartWork;
                    i >= workerStartWork &&
                    i <= workerEndWork - timeReserwation;
                    i = i + timeReservationEveryTime
                  ) {
                    avaibleHoursToConvert.push(i);
                  }

                  // filtrowanie i konwertowanie tablicy rezerwacji i porównywanie dostępnych godzin
                  avaibleHoursToConvert = avaibleHoursToConvert.filter(
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
                            itemAvaible >= reserwationStart &&
                            itemAvaible < reserwationEnd
                          );
                        });
                        return !isActive;
                      } else {
                        return true;
                      }
                    }
                  );

                  // konwertowanie liczb na godziny oraz minuty
                  const unConvertAvaibleHours = avaibleHoursToConvert.map(
                    (item) => {
                      let timeService = "";
                      if (Number(item) < 60) {
                        timeService = `0:${item}`;
                      } else {
                        const numberTime = Number(item);
                        const numberOfHours = Math.floor(numberTime / 60);
                        if (Number(item) % 60 === 0) {
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
                      return timeService;
                    }
                  );
                  res.status(201).json({
                    avaibleHours: unConvertAvaibleHours,
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
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.find({
    fromUser: userId,
    dateYear: selectedYear,
    dateMonth: selectedMonth,
    workerReserwation: false,
  })
    .populate("toWorkerUserId", "name surname")
    .populate("company", "name linkPath")
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
        .populate(
          "workers.user",
          "_id name surname"
        )
        .then((resultCompany) => {
          if (!!resultCompany) {
            let isActiveWorker = userId == resultCompany.owner;
            if(!!!isActiveWorker){
              const isWorkerInWorkers = resultCompany.workers.some(
                (worker) => worker.user._id == userId
              );
              isActiveWorker = isWorkerInWorkers;
            }
            
            if (isActiveWorker){
              res.status(201).json({
                reserwations: {
                  reserwations: reserwationsDoc,
                  company: resultCompany,
                },
              });
            }else{
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
        if(isGoodDate){
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
        }else{
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
            const reserwationStatus = resultReserwation.visitCanceled ? "rezerwation_canceled" : resultReserwation.visitChanged ? "rezerwation_changed" : resultReserwation.visitNotFinished ? "reserwation_not_finished" : "reserwation_finished"
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