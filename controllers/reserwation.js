const Reserwation = require("../models/reserwation");
const User = require("../models/user");
const Company = require("../models/company");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const { validationResult } = require("express-validator");
const io = require("../socket");
const mongoose = require("mongoose");
const notifications = require("../middleware/notifications");

exports.addReserwation = (req, res, next) => {
  const userId = req.userId;
  const workerId = req.body.workerId;
  const workerUserId = req.body.workerUserId;
  const companyId = req.body.companyId;
  const dateStart = req.body.dateStart;
  const dateFull = req.body.dateFull;
  const reserwationMessage = req.body.reserwationMessage;
  const serviceId = req.body.serviceId;
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

  const resultDayMinus = new Date(
    Number(arrayDateFull[2]),
    Number(arrayDateFull[1]) - 1,
    Number(arrayDateFull[0]) - 1,
    Number(splitDateStart[0]),
    Number(splitDateStart[1])
  );

  const resultDayPlus = new Date(
    Number(arrayDateFull[2]),
    Number(arrayDateFull[1]) - 1,
    Number(arrayDateFull[0]) + 1,
    Number(splitDateStart[0]),
    Number(splitDateStart[1])
  );

  let newReserwationDraftId = null;

  Reserwation.find({
    company: companyId,
    toWorkerUserId: workerUserId,
    dateDay: Number(arrayDateFull[0]),
    dateMonth: Number(arrayDateFull[1]),
    dateYear: Number(arrayDateFull[2]),
    visitCanceled: false,
    isDeleted: { $in: [false, null] },
  })
    .then((allReserwations) => {
      return Company.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(companyId),
            pauseCompany: false,
            premium: {
              $gte: new Date(),
            },
          },
        },
        { $unwind: "$ownerData" },
        {
          $project: {
            openingDays: 1,
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
                        mongoose.Types.ObjectId(workerUserId),
                      ],
                    },
                  ],
                },
              },
            },
            services: {
              $filter: {
                input: "$services",
                as: "serviceitem",
                cond: {
                  $and: [
                    {
                      $eq: [
                        "$$serviceitem._id",
                        mongoose.Types.ObjectId(serviceId),
                      ],
                    },
                  ],
                },
              },
            },
            owner: 1,
            daysOff: {
              $filter: {
                input: "$daysOff",
                as: "dayOffItem",
                cond: {
                  $and: [
                    {
                      $eq: ["$$dayOffItem.day", Number(arrayDateFull[0])],
                    },
                    {
                      $eq: ["$$dayOffItem.month", Number(arrayDateFull[1])],
                    },
                    {
                      $eq: ["$$dayOffItem.year", Number(arrayDateFull[2])],
                    },
                  ],
                },
              },
            },
            reservationMonthTime: 1,
            reservationEveryTime: 1,
            promotions: 1,
            usersInformation: 1,
            happyHoursConst: 1,
            companyStamps: 1,
            premium: 1,
            smsReserwationAvaible: 1,
            smsReserwationChangedUserAvaible: 1,
            smsNotifactionAvaible: 1,
            sms: 1,
            pauseCompany: 1,
            _id: 1,
          },
        },
        { $unwind: { path: "$workers", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$services", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            openingDays: 1,
            ownerData: {
              _id: 1,
              specialization: 1,
              user: 1,
              constantWorkingHours: 1,
              active: 1,
              permissions: 1,
              servicesCategory: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$ownerData.noConstantWorkingHours",
                  as: "itemOwner",
                  cond: {
                    $and: [
                      { $gte: ["$$itemOwner.start", resultDayMinus] },
                      { $lte: ["$$itemOwner.start", resultDayPlus] },
                    ],
                  },
                },
              },
            },
            workers: {
              _id: 1,
              specialization: 1,
              user: 1,
              constantWorkingHours: 1,
              active: 1,
              permissions: 1,
              servicesCategory: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$workers.noConstantWorkingHours",
                  as: "item",
                  cond: {
                    $and: [
                      { $gte: ["$$item.start", resultDayMinus] },
                      { $lte: ["$$item.start", resultDayPlus] },
                    ],
                  },
                },
              },
            },
            owner: 1,
            daysOff: 1,
            reservationMonthTime: 1,
            reservationEveryTime: 1,
            services: 1,
            promotions: 1,
            usersInformation: {
              $filter: {
                input: "$usersInformation",
                as: "userInfo",
                cond: {
                  $and: [
                    {
                      $eq: [
                        "$$userInfo.userId",
                        mongoose.Types.ObjectId(userId),
                      ],
                    },
                  ],
                },
              },
            },
            happyHoursConst: 1,
            companyStamps: 1,
            premium: 1,
            smsReserwationAvaible: 1,
            smsReserwationChangedUserAvaible: 1,
            smsNotifactionAvaible: 1,
            sms: 1,
            pauseCompany: 1,
            _id: 1,
          },
        },
      ])
        .then((companyDoc) => {
          if (companyDoc.length > 0) {
            const companyDocData = companyDoc[0];
            return User.findOne({
              _id: userId,
            })
              .select("_id stamps")
              .populate(
                "stamps.reserwations",
                "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company visitCanceled fullDate"
              )
              .then((resultUserDoc) => {
                if (!!resultUserDoc) {
                  let newReserwationToValid = null;
                  if (!!companyDocData.services) {
                    const splitDateStartToValid = dateStart.split(":");
                    let numberDateEnd =
                      Number(splitDateStartToValid[0]) * 60 +
                      Number(splitDateStartToValid[1]) +
                      Number(companyDocData.services.time);
                    const numberWith2Spaces = (numberDateEnd / 60).toFixed(2);
                    const splitNumberWithComa = numberWith2Spaces.split(".");
                    const otherNumberValue = numberDateEnd % 60;
                    const endDateToValidCompany = `${splitNumberWithComa[0]}:${otherNumberValue}`;
                    newReserwationToValid = new Reserwation({
                      fromUser: userId,
                      toWorkerUserId: workerUserId,
                      company: companyId,
                      dateYear: Number(arrayDateFull[2]),
                      dateMonth: Number(arrayDateFull[1]),
                      dateDay: Number(arrayDateFull[0]),
                      dateStart: dateStart,
                      dateEnd: endDateToValidCompany,
                      fullDate: actualDate,
                      workerReserwation: false,
                      isDraft: true,
                      hasCommuniting: false,
                    });
                    newReserwationDraftId = newReserwationToValid._id;
                  }
                  if (!!newReserwationToValid) {
                    return newReserwationToValid
                      .save()
                      .then((resultSavePreBooking) => {
                        let userIsBlocked = false;
                        const validUserInformation =
                          !!companyDocData.usersInformation
                            ? companyDocData.usersInformation
                            : [];
                        const isUserInUsersInformations =
                          validUserInformation.findIndex(
                            (infUser) => infUser.userId == userId
                          );

                        if (isUserInUsersInformations >= 0) {
                          userIsBlocked =
                            companyDocData.usersInformation[
                              isUserInUsersInformations
                            ].isBlocked;
                        }

                        if (isGoodTimeDate) {
                          if (!!!userIsBlocked) {
                            let selectedWorker = null;
                            if (companyDocData.owner == workerUserId) {
                              selectedWorker = companyDocData.ownerData;
                            } else {
                              if (!!companyDocData.workers) {
                                if (!!companyDocData.workers._id) {
                                  if (companyDocData.workers._id == workerId) {
                                    selectedWorker = companyDocData.workers;
                                  }
                                }
                              }
                            }
                            if (!!selectedWorker) {
                              let selectedServices = null;
                              if (companyDocData.services._id) {
                                selectedServices = companyDocData.services;
                              }
                              if (!!selectedServices) {
                                const disabledWorkerDate = [];
                                let isEmptyDate = true;

                                const arrayDateStartNewReserwation =
                                  dateStart.split(":");

                                const convertDateStartToMinNewReserwation =
                                  Number(arrayDateStartNewReserwation[0]) * 60 +
                                  Number(arrayDateStartNewReserwation[1]);

                                const dateEndNewReserwation =
                                  convertDateStartToMinNewReserwation +
                                  Number(selectedServices.time);
                                //////////////////////////////////////////////////////////////////////////

                                const selectedDate = new Date(
                                  Number(arrayDateFull[2]),
                                  Number(arrayDateFull[1]) - 1,
                                  Number(arrayDateFull[0]),
                                  10,
                                  0,
                                  0,
                                  0
                                );
                                const selectedDateDayOfTheWeek =
                                  selectedDate.getDay();
                                const selectedFullDate = `${Number(
                                  arrayDateFull[0]
                                )}-${Number(arrayDateFull[1])}-${Number(
                                  arrayDateFull[2]
                                )}`;
                                const mapWorkerConstWorkingHours =
                                  selectedWorker.constantWorkingHours.map(
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

                                const workerConstWorkingHours =
                                  mapWorkerConstWorkingHours.find(
                                    (item) =>
                                      item.dayOfTheWeek ===
                                      selectedDateDayOfTheWeek
                                  );
                                let workerNoConstWorkingHours =
                                  selectedWorker.noConstantWorkingHours.find(
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
                                    fullDate:
                                      workerNoConstWorkingHours.fullDate,
                                    holidays:
                                      workerNoConstWorkingHours.holidays,
                                    start: startDateResult,
                                    end: endDateResult,
                                  };
                                  workerNoConstWorkingHours = newDateNoConst;
                                }
                                const selectedOpenTimeDay =
                                  !!workerNoConstWorkingHours
                                    ? workerNoConstWorkingHours.holidays
                                      ? null
                                      : workerNoConstWorkingHours
                                    : workerConstWorkingHours;
                                /////////////////////////////////////////////////////////////
                                const splitOpenWorker =
                                  selectedOpenTimeDay.start.split(":");
                                const splitCloseWorker =
                                  selectedOpenTimeDay.end.split(":");

                                const convertDateStartWorkWorker =
                                  Number(splitOpenWorker[0]) * 60 +
                                  Number(splitOpenWorker[1]);

                                const convertDateEndWorkWorker =
                                  Number(splitCloseWorker[0]) * 60 +
                                  Number(splitCloseWorker[1]);

                                allReserwations.forEach((workerReserwation) => {
                                  const arrayDateStart =
                                    workerReserwation.dateStart.split(":");

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

                                disabledWorkerDate.forEach(
                                  (disabledDateItem) => {
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
                                      disabledDateItem.dateEnd <=
                                        dateEndNewReserwation;

                                    if (
                                      isStartInDate ||
                                      isEndInDate ||
                                      isStartLowerAndEndBigger
                                    ) {
                                      isEmptyDate = false;
                                    }
                                  }
                                );

                                const companyIsClose =
                                  selectedOpenTimeDay.disabled ||
                                  convertDateStartToMinNewReserwation <
                                    convertDateStartWorkWorker ||
                                  convertDateEndWorkWorker <
                                    dateEndNewReserwation;

                                const findOffDay = companyDocData.daysOff.some(
                                  (dayOff) =>
                                    dayOff.day === Number(arrayDateFull[0]) &&
                                    dayOff.month === Number(arrayDateFull[1]) &&
                                    dayOff.year === Number(arrayDateFull[2])
                                );

                                // sprawdzanie rezerwacji do przodu
                                let dateToReserwIsGood = true;
                                if (!!companyDocData.reservationMonthTime) {
                                  const maxDateToReserw = new Date(
                                    new Date().setMonth(
                                      new Date().getMonth() +
                                        companyDocData.reservationMonthTime
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
                                      if (
                                        Number(dateEndNewReserwation) % 60 ===
                                        0
                                      ) {
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
                                    const newDateConvertToValidDateDateFull =
                                      new Date(convertToValidDateDateFull);

                                    const dayNewDateConvertToValidDateDateFull =
                                      newDateConvertToValidDateDateFull.getDay();

                                    //promotions
                                    const filterSelectedPromotions =
                                      companyDocData.promotions.filter(
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

                                          const isServiceInPromotion =
                                            promotionItem.servicesInPromotion.some(
                                              (promotionItemService) =>
                                                promotionItemService ==
                                                selectedServices._id
                                            );
                                          return (
                                            isServiceInPromotion &&
                                            isDayInPromotion
                                          );
                                        }
                                      );
                                    let promotionNumber = null;

                                    if (filterSelectedPromotions.length > 0) {
                                      filterSelectedPromotions.sort((a, b) => {
                                        const firstItemToSort =
                                          a.promotionPercent;
                                        const secondItemToSort =
                                          b.promotionPercent;
                                        if (firstItemToSort < secondItemToSort)
                                          return 1;
                                        if (firstItemToSort > secondItemToSort)
                                          return -1;
                                        return 0;
                                      });

                                      promotionNumber =
                                        filterSelectedPromotions[0]
                                          .promotionPercent;
                                    }

                                    //happy hours
                                    const filterSelectedHappyHours =
                                      companyDocData.happyHoursConst.filter(
                                        (happyHourItem) => {
                                          const isSelectedDayHappyHour =
                                            happyHourItem.dayWeekIndex.some(
                                              (happyHourItemService) =>
                                                happyHourItemService ===
                                                dayNewDateConvertToValidDateDateFull
                                            );

                                          const isServiceInHappyHour =
                                            happyHourItem.servicesInPromotion.some(
                                              (happyHourItemService) =>
                                                happyHourItemService ==
                                                serviceId
                                            );
                                          const splitDateStart =
                                            happyHourItem.start.split(":");
                                          const splitDateEnd =
                                            happyHourItem.end.split(":");
                                          const dateStartToValid = new Date(
                                            new Date(
                                              newDateConvertToValidDateDateFull.setHours(
                                                Number(splitDateStart[0])
                                              )
                                            ).setMinutes(
                                              Number(splitDateStart[1])
                                            )
                                          );
                                          const dateEndToValid = new Date(
                                            new Date(
                                              newDateConvertToValidDateDateFull.setHours(
                                                Number(splitDateEnd[0])
                                              )
                                            ).setMinutes(
                                              Number(splitDateEnd[1])
                                            )
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
                                        const firstItemToSort =
                                          a.promotionPercent;
                                        const secondItemToSort =
                                          b.promotionPercent;
                                        if (firstItemToSort < secondItemToSort)
                                          return 1;
                                        if (firstItemToSort > secondItemToSort)
                                          return -1;
                                        return 0;
                                      });
                                      happyHourNumber =
                                        filterSelectedHappyHours[0]
                                          .promotionPercent;
                                    }

                                    // promotionNumber; happyHourNumber

                                    // promotion in stamp

                                    let stampNumber = null;
                                    if (
                                      !!!promotionNumber &&
                                      !!!happyHourNumber &&
                                      !!isStampActive
                                    ) {
                                      const filterCompanyStampsNoDisabled =
                                        companyDocData.companyStamps.filter(
                                          (item) => item.disabled === false
                                        );

                                      filterCompanyStampsNoDisabled.sort(
                                        (a, b) => {
                                          const firstItemToSort =
                                            a.countStampsToActive;
                                          const secondItemToSort =
                                            b.countStampsToActive;
                                          if (
                                            firstItemToSort < secondItemToSort
                                          )
                                            return -1;
                                          if (
                                            firstItemToSort > secondItemToSort
                                          )
                                            return 1;
                                          return 0;
                                        }
                                      );

                                      //was companyDoc.companyStamps <- filterCompanyStampsNoDisabled
                                      const findCompanyStamp =
                                        filterCompanyStampsNoDisabled.find(
                                          (itemStamp) => {
                                            const isInStampsService =
                                              itemStamp.servicesId.some(
                                                (stampService) =>
                                                  stampService.toString() ===
                                                  serviceId.toString()
                                              );
                                            return isInStampsService;
                                          }
                                        );

                                      if (!!findCompanyStamp) {
                                        if (!!!findCompanyStamp.disabled) {
                                          const findStampId =
                                            resultUserDoc.stamps.findIndex(
                                              (itemStamp) => {
                                                return (
                                                  itemStamp.companyId.toString() ===
                                                  companyId.toString()
                                                );
                                              }
                                            );

                                          if (findStampId >= 0) {
                                            let numberOfActiveStamps = 0;
                                            const badDateReserwations = [];
                                            const goodDateReserwations = [];

                                            resultUserDoc.stamps[
                                              findStampId
                                            ].reserwations.forEach(
                                              (stampReserwation) => {
                                                const splitDateEnd =
                                                  stampReserwation.dateEnd.split(
                                                    ""
                                                  );
                                                const reserwationStampDateEnd =
                                                  new Date(
                                                    stampReserwation.dateYear,
                                                    stampReserwation.dateMonth -
                                                      1,
                                                    stampReserwation.dateDay,
                                                    Number(splitDateEnd[0]),
                                                    Number(splitDateEnd[1])
                                                  );

                                                if (
                                                  !!!stampReserwation.visitCanceled &&
                                                  reserwationStampDateEnd <
                                                    new Date()
                                                ) {
                                                  numberOfActiveStamps =
                                                    numberOfActiveStamps + 1;
                                                  goodDateReserwations.push(
                                                    stampReserwation
                                                  );
                                                } else {
                                                  badDateReserwations.push(
                                                    stampReserwation
                                                  );
                                                }
                                              }
                                            );
                                            if (
                                              numberOfActiveStamps > 0 &&
                                              findCompanyStamp.countStampsToActive <=
                                                numberOfActiveStamps
                                            ) {
                                              goodDateReserwations.sort(
                                                (a, b) => {
                                                  const firstItemToSort =
                                                    new Date(a.fullDate);
                                                  const secondItemToSort =
                                                    new Date(b.fullDate);
                                                  if (
                                                    firstItemToSort <
                                                    secondItemToSort
                                                  )
                                                    return -1;
                                                  if (
                                                    firstItemToSort >
                                                    secondItemToSort
                                                  )
                                                    return 1;
                                                  return 0;
                                                }
                                              );
                                              stampNumber =
                                                findCompanyStamp.promotionPercent;
                                              const newGoodDateReserwation =
                                                goodDateReserwations.slice(
                                                  findCompanyStamp.countStampsToActive
                                                );
                                              const newUserReserwations = [
                                                ...badDateReserwations,
                                                ...newGoodDateReserwation,
                                              ];

                                              resultUserDoc.stamps[
                                                findStampId
                                              ].reserwations = newUserReserwations;
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
                                    const resultPriceAfterPromotion =
                                      Math.floor(
                                        (selectedServices.serviceCost *
                                          (100 - resultPromotion)) /
                                          100
                                      );

                                    return Reserwation.updateOne(
                                      {
                                        _id: newReserwationDraftId._id,
                                      },
                                      {
                                        $set: {
                                          sendSMSReserwation: false,
                                          sendSMSNotifaction: false,
                                          sendSMSCanceled: false,
                                          sendSMSChanged: false,
                                          isDraft: false,
                                          dateStart: dateStart,
                                          dateEnd: timeEndService,
                                          costReserwation:
                                            resultPriceAfterPromotion,
                                          timeReserwation:
                                            selectedServices.time,
                                          serviceName:
                                            selectedServices.serviceName,
                                          visitNotFinished: false,
                                          visitCanceled: false,
                                          visitChanged: false,
                                          extraCost: selectedServices.extraCost,
                                          extraTime: selectedServices.extraTime,
                                          reserwationMessage:
                                            reserwationMessage,
                                          workerReserwation: false,
                                          serviceId: selectedServices._id,
                                          fullDate: actualDate,
                                          activePromotion: !!promotionNumber
                                            ? true
                                            : false,
                                          activeHappyHour: !!happyHourNumber
                                            ? true
                                            : false,
                                          activeStamp: !!stampNumber
                                            ? true
                                            : false,
                                          basicPrice:
                                            selectedServices.serviceCost,
                                          isDeleted: false,
                                        },
                                      }
                                    )
                                      .then(() => {
                                        newReserwationDraftId.isDeleted = false;
                                        newReserwationDraftId.sendSMSReserwation = false;
                                        newReserwationDraftId.sendSMSNotifaction = false;
                                        newReserwationDraftId.sendSMSCanceled = false;
                                        newReserwationDraftId.sendSMSChanged = false;
                                        newReserwationToValid.isDraft = false;
                                        newReserwationToValid.dateStart =
                                          dateStart;
                                        newReserwationToValid.dateEnd =
                                          timeEndService;
                                        newReserwationToValid.costReserwation =
                                          resultPriceAfterPromotion;
                                        newReserwationToValid.timeReserwation =
                                          selectedServices.time;
                                        newReserwationToValid.serviceName =
                                          selectedServices.serviceName;
                                        newReserwationToValid.visitNotFinished = false;
                                        newReserwationToValid.visitCanceled = false;
                                        newReserwationToValid.visitChanged = false;
                                        newReserwationToValid.extraCost =
                                          selectedServices.extraCost;
                                        newReserwationToValid.extraTime =
                                          selectedServices.extraTime;
                                        newReserwationToValid.reserwationMessage =
                                          reserwationMessage;
                                        newReserwationToValid.workerReserwation = false;
                                        newReserwationToValid.serviceId =
                                          selectedServices._id;
                                        newReserwationToValid.fullDate =
                                          actualDate;
                                        newReserwationToValid.activePromotion =
                                          !!promotionNumber ? true : false;
                                        newReserwationToValid.activeHappyHour =
                                          !!happyHourNumber ? true : false;
                                        newReserwationToValid.activeStamp =
                                          !!stampNumber ? true : false;
                                        newReserwationToValid.basicPrice =
                                          selectedServices.serviceCost;

                                        return {
                                          companyDoc: companyDocData,
                                          newReserwation: newReserwationToValid,
                                        };
                                      })
                                      .catch((err) => {
                                        Reserwation.deleteOne({
                                          _id: resultSavePreBooking._id,
                                        }).then(() => {});
                                        const error = new Error(
                                          "Błąd podczas składania rezerwacji."
                                        );
                                        error.statusCode = 420;
                                        throw error;
                                      });
                                  } else {
                                    Reserwation.deleteOne({
                                      _id: resultSavePreBooking._id,
                                    }).then(() => {});
                                    const error = new Error(
                                      "Podany termin jest zajęty."
                                    );
                                    error.statusCode = 422;
                                    throw error;
                                  }
                                } else {
                                  Reserwation.deleteOne({
                                    _id: resultSavePreBooking._id,
                                  }).then(() => {});
                                  const error = new Error(
                                    "Brak możliwości rezerwacji w podanym terminie."
                                  );
                                  error.statusCode = 422;
                                  throw error;
                                }
                              } else {
                                Reserwation.deleteOne({
                                  _id: resultSavePreBooking._id,
                                }).then(() => {});
                                const error = new Error("Brak podanej usługi.");
                                error.statusCode = 422;
                                throw error;
                              }
                            } else {
                              Reserwation.deleteOne({
                                _id: resultSavePreBooking._id,
                              }).then(() => {});
                              const error = new Error(
                                "Brak podanego pracownika."
                              );
                              error.statusCode = 422;
                              throw error;
                            }
                          } else {
                            Reserwation.deleteOne({
                              _id: resultSavePreBooking._id,
                            }).then(() => {});
                            const error = new Error(
                              "Użytkownik został zablokowany do rezerwacji w tej firmie."
                            );
                            error.statusCode = 422;
                            throw error;
                          }
                        } else {
                          Reserwation.deleteOne({
                            _id: resultSavePreBooking._id,
                          }).then(() => {});
                          const error = new Error(
                            "Nie można dokonywać rezerwacji w tym terminie."
                          );
                          error.statusCode = 422;
                          throw error;
                        }
                      })
                      .catch((err) => {
                        if (!err.statusCode) {
                          err.statusCode = 501;
                          err.message =
                            "Błąd podczas składania wstępnej rezerwacji czasu.";
                        }
                        next(err);
                      });
                  } else {
                    const error = new Error(
                      "Błąd podczas wstępnego zapisu rezerwacji."
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
              .catch((err) => {
                if (!err.statusCode) {
                  err.statusCode = 501;
                  err.message = "Błąd podczas pobieranie danych o firmie.";
                }
                next(err);
              });
          } else {
            const error = new Error(
              "Brak firmy lub konto firmowe jest nieaktywne."
            );
            error.statusCode = 419;
            throw error;
          }
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych o rezerwacjach.";
          }
          next(err);
        });
    })
    .then((result) => {
      if (!!result) {
        if (!!result.newReserwation) {
          return result.newReserwation;
        } else {
          Reserwation.deleteOne({
            _id: newReserwationDraftId,
          }).then(() => {});
          const error = new Error(
            "Nie można dokonywać rezerwacji w tym terminie."
          );
          error.statusCode = 422;
          throw error;
        }
      } else {
        Reserwation.deleteOne({
          _id: newReserwationDraftId,
        }).then(() => {});
        const error = new Error(
          "Nie można dokonywać rezerwacji w tym terminie."
        );
        error.statusCode = 422;
        throw error;
      }
    })
    .then((resultReserwation) => {
      return User.find({
        _id: { $in: [userId] },
        accountVerified: true,
      })
        .select("_id stamps")
        .then((allUsers) => {
          if (!!allUsers) {
            return resultReserwation
              .populate(
                "reserwationId",
                "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company"
              )
              .populate(
                {
                  path: "company fromUser toWorkerUserId",
                  select:
                    "_id name surname linkPath smsReserwationChangedUserAvaible smsReserwationAvaible sms companyStamps",
                },
                async (err, resultReserwationPopulate) => {
                  const emailContent = `
                        Dokonano rezerwacji, nazwa usługi: ${
                          resultReserwationPopulate.serviceName
                        },termin: ${resultReserwationPopulate.dateDay}-${
                    resultReserwationPopulate.dateMonth
                  }-${resultReserwationPopulate.dateYear}, godzina: ${
                    resultReserwationPopulate.dateStart
                  }, czas trwania: ${
                    resultReserwationPopulate.timeReserwation
                  }min ${
                    resultReserwationPopulate.extraTime ? "+" : ""
                  }, koszt: ${resultReserwationPopulate.costReserwation} zł ${
                    resultReserwationPopulate.extraCost ? "+" : ""
                  }.`;

                  const payload = {
                    title: `
                        Dokonano rezerwacji, nazwa usługi: ${
                          resultReserwationPopulate.serviceName
                        },termin: ${resultReserwationPopulate.dateDay}-${
                      resultReserwationPopulate.dateMonth
                    }-${resultReserwationPopulate.dateYear}, godzina: ${
                      resultReserwationPopulate.dateStart
                    }, czas trwania: ${
                      resultReserwationPopulate.timeReserwation
                    }min ${
                      resultReserwationPopulate.extraTime ? "+" : ""
                    }, koszt: ${resultReserwationPopulate.costReserwation} zł ${
                      resultReserwationPopulate.extraCost ? "+" : ""
                    }.`,
                    body: "this is the body",
                    icon: "images/someImageInPath.png",
                  };

                  const emailSubject = `Dokonano rezerwację`;
                  const message = `
                        Dokonano rezerwacji, nazwa usługi: ${
                          resultReserwationPopulate.serviceName
                        },termin: ${resultReserwationPopulate.dateDay}-${
                    resultReserwationPopulate.dateMonth
                  }-${resultReserwationPopulate.dateYear}, godzina: ${
                    resultReserwationPopulate.dateStart
                  }, czas trwania: ${
                    resultReserwationPopulate.timeReserwation
                  }min ${
                    resultReserwationPopulate.extraTime ? "+" : ""
                  }, koszt: ${resultReserwationPopulate.costReserwation} zł ${
                    resultReserwationPopulate.extraCost ? "+" : ""
                  }.`;

                  const { resultSMS } = await notifications.sendAll({
                    usersId: [
                      resultReserwationPopulate.fromUser._id,
                      resultReserwationPopulate.toWorkerUserId._id,
                    ],
                    clientId: resultReserwationPopulate.fromUser._id,
                    emailContent: {
                      customEmail: null,
                      emailTitle: emailSubject,
                      emailMessage: emailContent,
                    },
                    notificationContent: {
                      typeAlert: "reserwationId",
                      dateAlert: resultReserwationPopulate,
                      typeNotification: "reserwation_created",
                      payload: payload,
                      companyChanged: false,
                    },
                    smsContent: {
                      companyId: companyId,
                      customPhone: null,
                      companySendSMSValidField: "smsReserwationAvaible",
                      titleCompanySendSMS: "sms_created_reserwation",
                      message: message,
                    },
                  });

                  if (!!resultSMS) {
                    Reserwation.updateOne(
                      {
                        _id: resultReserwationPopulate._id,
                        sendSMSReserwation: false,
                      },
                      {
                        $set: {
                          sendSMSReserwation: true,
                        },
                      }
                    ).then(() => {});
                  }

                  const bulkArrayToUpdate = [];
                  if (allUsers.length > 0) {
                    allUsers.forEach((userResult) => {
                      if (
                        !!!resultReserwation.activePromotion &&
                        !!!resultReserwation.activeHappyHour &&
                        !!!resultReserwation.activeStamp &&
                        userResult._id.toString() ===
                          resultReserwation.fromUser._id.toString()
                      ) {
                        if (!!resultReserwationPopulate.company.companyStamps) {
                          const findCompanyStamp =
                            resultReserwationPopulate.company.companyStamps.find(
                              (itemStamp) => {
                                const isInStampsService =
                                  itemStamp.servicesId.some(
                                    (stampService) =>
                                      stampService.toString() ===
                                      serviceId.toString()
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
                                bulkArrayToUpdate.push({
                                  updateOne: {
                                    filter: {
                                      _id: userResult._id,
                                      "stamps._id":
                                        userResult.stamps[findStampId]._id,
                                    },
                                    update: {
                                      $addToSet: {
                                        "stamps.$.reserwations":
                                          resultReserwation._id,
                                      },
                                    },
                                  },
                                });
                              } else {
                                const newStamp = {
                                  companyId: resultReserwation.company,
                                  reserwations: [resultReserwation._id],
                                };

                                bulkArrayToUpdate.push({
                                  updateOne: {
                                    filter: {
                                      _id: userResult._id,
                                    },
                                    update: {
                                      $addToSet: {
                                        stamps: newStamp,
                                      },
                                    },
                                  },
                                });
                              }
                            }
                          }
                        }
                      }
                    });
                  } else {
                    Reserwation.deleteOne({
                      _id: newReserwationDraftId,
                    }).then(() => {});
                    const error = new Error(
                      "Błąd podczas wysyłania powiadomień użytkownikom. Rezerwaca została odwołana."
                    );
                    error.statusCode = 422;
                    throw error;
                  }

                  return User.bulkWrite(bulkArrayToUpdate)
                    .then(() => {
                      return true;
                    })
                    .catch((err) => {
                      console.log(err);
                      const error = new Error(
                        "Błąd podczas wysyłania powiadomień użytkownikom. Rezerwaca została odwołana."
                      );
                      error.statusCode = 422;
                      throw error;
                    });
                }
              );
          }
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

  Company.findOne({
    _id: companyId,
    premium: {
      $gte: new Date().toISOString(),
    },
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
            hasPermission = true;
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
        const error = new Error(
          "Brak wybranej firmy lub konto firmowe jest nieaktywne."
        );
        error.statusCode = 403;
        throw error;
      }
    })
    .then(() => {
      return Reserwation.find({
        company: companyId,
        toWorkerUserId: workerUserId,
        dateDay: Number(arrayDateFull[0]),
        dateMonth: Number(arrayDateFull[1]),
        dateYear: Number(arrayDateFull[2]),
        visitCanceled: false,
        isDeleted: { $in: [false, null] },
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
            hasCommuniting: false,
            isDeleted: false,
          });
          return newReserwationWorker.save();
        })
        .then((result) => {
          result
            .populate(
              "company",
              "linkPath name services._id services.serviceColor _id"
            )
            .populate(
              {
                path: "fromUser",
                select: "name surname _id",
              },
              function (err, resultReserwationPopulate) {
                io.getIO().emit(
                  `user${resultReserwationPopulate.toWorkerUserId}`,
                  {
                    action: "update-alerts",
                    alertData: {
                      reserwationId: resultReserwationPopulate,
                      active: true,
                      type: "new_reserwation_worker",
                      creationTime: new Date(),
                      companyChanged: true,
                    },
                  }
                );
                const newUserAlert = {
                  reserwationId: resultReserwationPopulate._id,
                  active: true,
                  type: "new_reserwation_worker",
                  creationTime: new Date(),
                  companyChanged: true,
                };

                User.updateOne(
                  {
                    _id: resultReserwationPopulate.toWorkerUserId,
                  },
                  {
                    $inc: { alertActiveCount: 1 },
                    $push: {
                      alerts: {
                        $each: [newUserAlert],
                        $position: 0,
                      },
                    },
                  }
                ).then(() => {
                  res.status(201).json({
                    reserwation: resultReserwationPopulate,
                  });
                });
              }
            );
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas składania rezerwacji czasu.";
          }
          next(err);
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

  const newDatePlus = new Date(
    Number(selectedYear),
    Number(selectedMonth - 1),
    Number(selectedDay + 1)
  );
  const newDateMinus = new Date(
    Number(selectedYear),
    Number(selectedMonth - 1),
    Number(selectedDay - 1)
  );

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
    isDeleted: { $in: [false, null] },
  })
    .select(
      "toWorkerUserId company dateYear dateMonth dateDay dateStart dateEnd visitCanceled"
    )
    .then((reserwationDoc) => {
      return Company.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(companyId),
            pauseCompany: false,
            premium: {
              $gte: new Date(),
            },
          },
        },
        { $unwind: "$ownerData" },
        {
          $project: {
            openingDays: 1,
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
                        mongoose.Types.ObjectId(workerUserId),
                      ],
                    },
                  ],
                },
              },
            },
            services: {
              $filter: {
                input: "$services",
                as: "serviceitem",
                cond: {
                  $and: [
                    {
                      $eq: [
                        "$$serviceitem._id",
                        mongoose.Types.ObjectId(serviceId),
                      ],
                    },
                  ],
                },
              },
            },
            owner: 1,
            daysOff: {
              $filter: {
                input: "$daysOff",
                as: "dayOffItem",
                cond: {
                  $and: [
                    {
                      $eq: ["$$dayOffItem.day", Number(selectedDay)],
                    },
                    {
                      $eq: ["$$dayOffItem.month", Number(selectedMonth)],
                    },
                    {
                      $eq: ["$$dayOffItem.year", Number(selectedYear)],
                    },
                  ],
                },
              },
            },
            reservationMonthTime: 1,
            reservationEveryTime: 1,
            promotions: 1,
            usersInformation: 1,
            happyHoursConst: 1,
            companyStamps: 1,
            premium: 1,
            smsReserwationAvaible: 1,
            smsNotifactionAvaible: 1,
            sms: 1,
            pauseCompany: 1,
            _id: 1,
          },
        },
        { $unwind: { path: "$workers", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$services", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            openingDays: 1,
            ownerData: {
              _id: 1,
              specialization: 1,
              user: 1,
              constantWorkingHours: 1,
              active: 1,
              permissions: 1,
              servicesCategory: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$ownerData.noConstantWorkingHours",
                  as: "itemOwner",
                  cond: {
                    $and: [
                      { $gte: ["$$itemOwner.start", newDateMinus] },
                      { $lte: ["$$itemOwner.start", newDatePlus] },
                    ],
                  },
                },
              },
            },
            workers: {
              _id: 1,
              specialization: 1,
              user: 1,
              constantWorkingHours: 1,
              active: 1,
              permissions: 1,
              servicesCategory: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$workers.noConstantWorkingHours",
                  as: "item",
                  cond: {
                    $and: [
                      { $gte: ["$$item.start", newDateMinus] },
                      { $lte: ["$$item.start", newDatePlus] },
                    ],
                  },
                },
              },
            },
            owner: 1,
            daysOff: 1,
            reservationMonthTime: 1,
            reservationEveryTime: 1,
            services: 1,
            promotions: 1,
            happyHoursConst: 1,
            companyStamps: 1,
            premium: 1,
            smsReserwationAvaible: 1,
            smsNotifactionAvaible: 1,
            sms: 1,
            pauseCompany: 1,
            _id: 1,
          },
        },
      ])
        .then((companyDoc) => {
          if (companyDoc.length > 0) {
            const companyDocData = companyDoc[0];
            let selectedWorker = null;
            if (companyDocData.owner == workerUserId) {
              selectedWorker = companyDocData.ownerData;
            } else {
              if (companyDocData.workers._id) {
                selectedWorker = companyDocData.workers;
              }
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
              const mapWorkerConstWorkingHours =
                selectedWorker.constantWorkingHours.map((item) => {
                  return {
                    _id: item._id,
                    dayOfTheWeek: item.dayOfTheWeek,
                    start: item.startWorking,
                    end: item.endWorking,
                    disabled: item.disabled,
                  };
                });

              const workerConstWorkingHours = mapWorkerConstWorkingHours.find(
                (item) => item.dayOfTheWeek === selectedDateDayOfTheWeek
              );
              let workerNoConstWorkingHours =
                selectedWorker.noConstantWorkingHours.find(
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

              const findOffDay = companyDocData.daysOff.some(
                (dayOff) =>
                  dayOff.day === selectedDay &&
                  dayOff.month === selectedMonth &&
                  dayOff.year === selectedYear
              );

              // sprawdzanie rezerwacji do przodu
              let dateToReserwIsGood = true;
              if (!!companyDocData.reservationMonthTime) {
                const maxDateToReserw = new Date(
                  new Date().setMonth(
                    new Date().getMonth() + companyDocData.reservationMonthTime
                  )
                );
                dateToReserwIsGood = maxDateToReserw >= selectedDate;
              }

              if (dateToReserwIsGood) {
                if (!!selectedDayToValid && !!!findOffDay) {
                  if (!!!selectedDayToValid.disabled) {
                    const workerStartWorkDate =
                      selectedDayToValid.start.split(":");
                    const workerEndWorkDate = selectedDayToValid.end.split(":");
                    const workerStartWork =
                      Number(workerStartWorkDate[0]) * 60 +
                      Number(workerStartWorkDate[1]);

                    const workerEndWork =
                      Number(workerEndWorkDate[0]) * 60 +
                      Number(workerEndWorkDate[1]);

                    const timeReservationEveryTime = Number(
                      companyDocData.reservationEveryTime
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
                    const dateConvertDateReserwationToDateInPromotions =
                      new Date(convertDateReserwationToDateInPromotions);
                    const filterSelectedPromotions =
                      companyDocData.promotions.filter((promotionItem) => {
                        const dateStartPromotion = new Date(
                          promotionItem.start
                        );
                        const dateEndPromotion = new Date(promotionItem.end);
                        const isDayInPromotion =
                          dateStartPromotion <=
                            dateConvertDateReserwationToDateInPromotions &&
                          dateEndPromotion >=
                            dateConvertDateReserwationToDateInPromotions;

                        const isServiceInPromotion =
                          promotionItem.servicesInPromotion.some(
                            (promotionItemService) =>
                              promotionItemService == serviceId
                          );
                        return isServiceInPromotion && isDayInPromotion;
                      });
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
                    const selectedReserwationDay =
                      dateConvertDateReserwationToDateInPromotions.getDay();
                    const filterSelectedHappyHours =
                      companyDocData.happyHoursConst.filter((happyHourItem) => {
                        const isSelectedDayHappyHour =
                          happyHourItem.dayWeekIndex.some(
                            (happyHourItemService) =>
                              happyHourItemService === selectedReserwationDay
                          );
                        const isServiceInHappyHour =
                          happyHourItem.servicesInPromotion.some(
                            (happyHourItemService) =>
                              happyHourItemService == serviceId
                          );
                        return isSelectedDayHappyHour && isServiceInHappyHour;
                      });
                    if (filterSelectedHappyHours.length > 0) {
                      filterSelectedHappyHours.sort((a, b) => {
                        const firstItemToSort = a.promotionPercent;
                        const secondItemToSort = b.promotionPercent;
                        if (firstItemToSort < secondItemToSort) return -1;
                        if (firstItemToSort > secondItemToSort) return 1;
                        return 0;
                      });
                      filterSelectedHappyHours.forEach((happyHour) => {
                        const dateHappyHourStartSplit =
                          happyHour.start.split(":");
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
                          const indexDaysInHappyHours =
                            daysInHappyHours.findIndex(
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
                    avaibleHoursToConvertWithPromotions =
                      avaibleHoursToConvertWithPromotions.filter(
                        (itemAvaible) => {
                          if (reserwationDoc.length > 0) {
                            const isActive = reserwationDoc.some(
                              (reserwation) => {
                                const reserwationStartDate =
                                  reserwation.dateStart.split(":");
                                const reserwationEndDate =
                                  reserwation.dateEnd.split(":");
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
                              }
                            );
                            return !isActive;
                          } else {
                            return true;
                          }
                        }
                      );

                    // konwertowanie liczb na godziny oraz minuty wraz z promocjami
                    const unConvertAvaibleHoursWithPromotions =
                      avaibleHoursToConvertWithPromotions.map((item) => {
                        let timeService = "";
                        if (Number(item.time) < 60) {
                          timeService = `0:${
                            item.time < 10 ? `0${item.time}` : item.time
                          }`;
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
                      });

                    res.status(201).json({
                      avaibleHoursWithPromotions:
                        unConvertAvaibleHoursWithPromotions,
                    });
                  } else {
                    const error = new Error(
                      "Pracownik ma wolne w podanym dniu."
                    );
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
          } else {
            const error = new Error(
              "Brak podanej firmy lub działalność jest wstrzymana."
            );
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
    isDraft: { $in: [false, null] },
    company: { $exists: true, $ne: null },
    fullDate: {
      $gte: new Date().toISOString(),
    },
    isDeleted: { $in: [false, null] },
  })
    .populate("toWorkerUserId", "name surname")
    .populate({
      path: "company",
      select:
        "name linkPath workers._id workers.user workers.active workers.servicesCategory workers.specialization ownerData.servicesCategory ownerData.specialization owner companyStamps services reservationMonthTime",
      populate: {
        path: "workers.user owner",
        select: "name surname imageOther imageUrl",
      },
    })
    .populate("opinionId", "")
    .then((reserwationsDoc) => {
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

          const splitDateReserwation = itemReserwation.dateEnd.split(":");
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
        isDraft: { $in: [false, null] },
        visitCanceled: false,
        fullDate: {
          $lte: new Date().toISOString(),
        },
        isDeleted: { $in: [false, null] },
      }
    : {
        fromUser: userId,
        dateYear: selectedYear,
        dateMonth: selectedMonth,
        workerReserwation: false,
        isDraft: { $in: [false, null] },
        fullDate: {
          $lte: new Date().toISOString(),
        },
        isDeleted: { $in: [false, null] },
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
        return !!item.company ? item.company.name : "None";
      });

      let tempReserwationsCategories = new Set(tempItemsReserwations);
      let allReserwationsCategories = Array.from(tempReserwationsCategories);

      let allItems = [];
      allReserwationsCategories.forEach((itemCategory) => {
        const filterItemsToCategory = reserwationsDoc.filter((item) => {
          const companyName = !!item.company ? item.company.name : "None";
          return companyName === itemCategory;
        });

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
    isDraft: { $in: [false, null] },
    isDeleted: { $in: [false, null] },
  })
    .populate("fromUser", "name surname")
    .populate("company", "name linkPath services.serviceColor services._id")
    .populate("communitingId", "_id city street description")
    .then((reserwationsDoc) => {
      return Company.findOne({ _id: companyId })
        .select(
          "owner services workers.user openingDays workers._id workers.servicesCategory workers.active ownerData._id ownerData.user ownerData.servicesCategory"
        )
        .populate("workers.user", "_id name surname")
        .populate("owner", "_id name surname")
        .then((resultCompany) => {
          if (!!resultCompany) {
            let isActiveWorker = userId == resultCompany.owner._id;
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
    isDeleted: { $in: [false, null] },
  })
    .select(
      "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company oldReserwationId visitCanceled"
    )
    .populate("toWorkerUserId fromUser", "_id name surname")
    .populate("company", "_id name linkPath")
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
            return Reserwation.updateOne(
              {
                fromUser: userId,
                _id: reserwationId,
                visitCanceled: false,
                visitNotFinished: false,
                isDeleted: { $in: [false, null] },
              },
              {
                $set: {
                  visitCanceled: true,
                },
              }
            ).then(() => {
              reserwationsDoc.visitCanceled = true;
              return reserwationsDoc;
            });
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
    .then(async (resultReserwation) => {
      const emailContent = `Odwołano rezerwację, nazwa usługi: ${resultReserwation.serviceName},termin: ${resultReserwation.dateDay}-${resultReserwation.dateMonth}-${resultReserwation.dateYear}, godzina: ${resultReserwation.dateStart}.`;
      const payload = {
        title: `Odwołano rezerwację, nazwa usługi: ${resultReserwation.serviceName},termin: ${resultReserwation.dateDay}-${resultReserwation.dateMonth}-${resultReserwation.dateYear}, godzina: ${resultReserwation.dateStart}.`,
        body: "this is the body",
        icon: "images/someImageInPath.png",
      };

      const emailSubject = `Dokonano zmiany rezerwacji`;
      const message = `Odwołano rezerwację, nazwa usługi: ${resultReserwation.serviceName},termin: ${resultReserwation.dateDay}-${resultReserwation.dateMonth}-${resultReserwation.dateYear}, godzina: ${resultReserwation.dateStart}.`;

      const { resultSMS } = await notifications.sendAll({
        usersId: [
          resultReserwation.fromUser._id,
          resultReserwation.toWorkerUserId._id,
        ],
        clientId: resultReserwation.fromUser._id,
        emailContent: {
          customEmail: null,
          emailTitle: emailSubject,
          emailMessage: emailContent,
        },
        notificationContent: {
          typeAlert: "reserwationId",
          dateAlert: resultReserwation,
          typeNotification: "reserwation_canceled",
          payload: payload,
          companyChanged: false,
        },
        smsContent: {
          companyId: resultReserwation.company._id,
          customPhone: null,
          companySendSMSValidField: "smsReserwationChangedUserAvaible",
          titleCompanySendSMS: "sms_user_canceled_reserwation",
          message: message,
        },
      });

      if (!!resultSMS) {
        Reserwation.updateOne(
          {
            _id: resultReserwation._id,
            sendSMSReserwationUserChanged: false,
          },
          {
            $set: {
              sendSMSReserwationUserChanged: true,
            },
          }
        ).then(() => {});
      }

      res.status(201).json({
        message: "Zaktualizowano rezerwację",
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
  const workerSelectedUserId = req.body.workerSelectedUserId;
  const dateReserwation = req.body.dateReserwation;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Reserwation.findOne({
    toWorkerUserId: workerUserId,
    _id: reserwationId,
    isDeleted: { $in: [false, null] },
  })
    .populate("toWorkerUserId fromUser", "_id name surname")
    .populate("company", "_id name owner workers.user")

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
        const isGoodDate = true;

        if (isGoodDate || reserwationsDoc.workerReserwation) {
          let isActiveWorker = userId == reserwationsDoc.company.owner;
          if (!!!isActiveWorker) {
            const isWorkerInWorkers = reserwationsDoc.company.workers.some(
              (worker) => worker.user == userId
            );
            isActiveWorker = isWorkerInWorkers;
          }
          if (isActiveWorker) {
            if (!!dateReserwation) {
              const validDateStartReserwation = !!newTimeStart
                ? newTimeStart
                : reserwationsDoc.dateStart;
              const splitDateStartReserwation =
                validDateStartReserwation.split(":");
              const splitNewDateReserwation = dateReserwation.split("-");
              const newDateReserwationToSave = new Date(
                Number(splitNewDateReserwation[2]),
                Number(splitNewDateReserwation[1]) - 1,
                Number(splitNewDateReserwation[0]),
                Number(splitDateStartReserwation[0]),
                Number(splitDateStartReserwation[1])
              );
              reserwationsDoc.fullDate = newDateReserwationToSave;
              reserwationsDoc.dateYear = Number(splitNewDateReserwation[2]);
              reserwationsDoc.dateMonth = Number(splitNewDateReserwation[1]);
              reserwationsDoc.dateDay = Number(splitNewDateReserwation[0]);
            }
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
            if (!!workerSelectedUserId) {
              reserwationsDoc.toWorkerUserId = workerSelectedUserId;
            }
            return Reserwation.updateOne(
              {
                _id: reserwationsDoc._id,
              },
              {
                $set: {
                  dateStart: reserwationsDoc.dateStart,
                  dateEnd: reserwationsDoc.dateEnd,
                  visitCanceled: reserwationsDoc.visitCanceled,
                  visitChanged: !!reserwationsDoc.visitNotFinished
                    ? false
                    : reserwationsDoc.visitChanged,
                  visitNotFinished: reserwationsDoc.visitNotFinished,
                  toWorkerUserId: reserwationsDoc.toWorkerUserId,
                  fullDate: reserwationsDoc.fullDate,
                  dateYear: reserwationsDoc.dateYear,
                  dateMonth: reserwationsDoc.dateMonth,
                  dateDay: reserwationsDoc.dateDay,
                },
              }
            )
              .then(() => {
                return reserwationsDoc;
              })
              .catch(() => {
                const error = new Error(
                  "Błąd podczas aktualizacji rezerwacji."
                );
                error.statusCode = 401;
                throw error;
              });
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
    .then(async (resultReserwation) => {
      const reserwationStatus = resultReserwation.visitNotFinished
        ? "reserwation_not_finished"
        : !!resultReserwation.workerReserwation
        ? "reserwation_worker"
        : resultReserwation.visitCanceled
        ? "reserwation_canceled"
        : resultReserwation.visitChanged
        ? "reserwation_changed"
        : "reserwation_finished";

      const reserwationValidCompanySMS = resultReserwation.visitNotFinished
        ? null
        : !!resultReserwation.workerReserwation
        ? null
        : resultReserwation.visitCanceled
        ? "smsCanceledAvaible"
        : resultReserwation.visitChanged
        ? "smsChangedAvaible"
        : null;

      const reserwationValidCompanySMSMessage =
        resultReserwation.visitNotFinished
          ? null
          : !!resultReserwation.workerReserwation
          ? null
          : resultReserwation.visitCanceled
          ? "sms_canceled_reserwation"
          : resultReserwation.visitChanged
          ? "sms_changed_reserwation"
          : null;

      const validTextStatusReserwation = resultReserwation.visitNotFinished
        ? "Oznaczono rezerwację jako nie odbytą"
        : !!resultReserwation.workerReserwation
        ? "Dodano rezerwację czasu"
        : resultReserwation.visitCanceled
        ? "Odwołano rezerwację"
        : resultReserwation.visitChanged
        ? "Dokonano zmiany w rezerwacji"
        : "Oznaczono rezerwację jako odbytą";

      const validStatusReserwation = !!resultReserwation.workerReserwation
        ? null
        : resultReserwation.visitCanceled
        ? { sendSMSCanceled: true }
        : resultReserwation.visitChanged
        ? { sendSMSChanged: true }
        : resultReserwation.visitNotFinished
        ? null
        : null;

      const emailContent = `${validTextStatusReserwation}, nazwa usługi: ${resultReserwation.serviceName},termin: ${resultReserwation.dateDay}-${resultReserwation.dateMonth}-${resultReserwation.dateYear}, godzina: ${resultReserwation.dateStart}.`;
      const payload = {
        title: `${validTextStatusReserwation}, nazwa usługi: ${resultReserwation.serviceName},termin: ${resultReserwation.dateDay}-${resultReserwation.dateMonth}-${resultReserwation.dateYear}, godzina: ${resultReserwation.dateStart}.`,
        body: "this is the body",
        icon: "images/someImageInPath.png",
      };

      const emailSubject = `${validTextStatusReserwation}`;
      const message = `${validTextStatusReserwation}, nazwa usługi: ${resultReserwation.serviceName},termin: ${resultReserwation.dateDay}-${resultReserwation.dateMonth}-${resultReserwation.dateYear}, godzina: ${resultReserwation.dateStart}.`;

      const { resultSMS } = await notifications.sendAll({
        usersId: [
          resultReserwation.fromUser._id,
          resultReserwation.toWorkerUserId._id,
        ],
        clientId: resultReserwation.fromUser._id,
        emailContent: !!!resultReserwation.workerReserwation &&
          !!validStatusReserwation && {
            customEmail: null,
            emailTitle: emailSubject,
            emailMessage: emailContent,
          },
        notificationContent: {
          typeAlert: "reserwationId",
          dateAlert: resultReserwation,
          typeNotification: reserwationStatus,
          payload: payload,
          companyChanged: true,
        },
        smsContent: !!!resultReserwation.workerReserwation &&
          !!validStatusReserwation && {
            companyId: resultReserwation.company._id,
            customPhone: null,
            companySendSMSValidField: reserwationValidCompanySMS,
            titleCompanySendSMS: reserwationValidCompanySMSMessage,
            message: message,
          },
      });

      if (
        !!resultSMS &&
        !!!resultReserwation.workerReserwation &&
        !!validStatusReserwation
      ) {
        Reserwation.updateOne(
          {
            _id: resultReserwation._id,
            sendSMSReserwationUserChanged: false,
          },
          {
            $set: validStatusReserwation,
          }
        ).then(() => {});
      }

      res.status(201).json({
        message: "Zaktualizowano rezerwację",
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

  Company.findOne({ _id: companyId })
    .populate("workers.user", "_id name surname")
    .select(
      "owner workers.permission workers._id workers.user usersInformation _id"
    )
    .populate("usersInformation.userId", "_id name surname")
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
          const bulkArrayToUpdate = [];

          resultCompany.usersInformation.forEach((item) => {
            if (!!item.userId) {
              arrayWithUsersReserwations.push(item);
            } else {
              bulkArrayToUpdate.push({
                updateOne: {
                  filter: {
                    _id: companyId,
                    "usersInformation._id": item._id,
                  },
                  update: {
                    $pull: {
                      usersInformation: {
                        _id: item._id,
                      },
                    },
                  },
                },
              });
            }
          });

          Company.bulkWrite(bulkArrayToUpdate)
            .then(() => {})
            .catch(() => {});

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
            isDraft: { $in: [false, null] },
            isDeleted: { $in: [false, null] },
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

exports.changeReserwation = (req, res, next) => {
  const userId = req.userId;
  const workerId = req.body.workerId;
  const workerUserId = req.body.workerUserId;
  const companyId = req.body.companyId;
  const dateStart = req.body.dateStart;
  const dateFull = req.body.dateFull;
  const reserwationMessage = req.body.reserwationMessage;
  const serviceId = req.body.serviceId;
  const isStampActive = req.body.isStampActive;
  const selectedReserwationId = req.body.selectedReserwationId;

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

  const resultDayMinus = new Date(
    Number(arrayDateFull[2]),
    Number(arrayDateFull[1]) - 1,
    Number(arrayDateFull[0]) - 1,
    Number(splitDateStart[0]),
    Number(splitDateStart[1])
  );

  const resultDayPlus = new Date(
    Number(arrayDateFull[2]),
    Number(arrayDateFull[1]) - 1,
    Number(arrayDateFull[0]) + 1,
    Number(splitDateStart[0]),
    Number(splitDateStart[1])
  );

  let newReserwationDraftId = null;

  Reserwation.find({
    company: companyId,
    toWorkerUserId: workerUserId,
    dateDay: Number(arrayDateFull[0]),
    dateMonth: Number(arrayDateFull[1]),
    dateYear: Number(arrayDateFull[2]),
    visitCanceled: false,
    isDeleted: { $in: [false, null] },
  })
    .then((allReserwations) => {
      return Company.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(companyId),
            pauseCompany: false,
            premium: {
              $gte: new Date(),
            },
          },
        },
        { $unwind: "$ownerData" },
        {
          $project: {
            openingDays: 1,
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
                        mongoose.Types.ObjectId(workerUserId),
                      ],
                    },
                  ],
                },
              },
            },
            services: {
              $filter: {
                input: "$services",
                as: "serviceitem",
                cond: {
                  $and: [
                    {
                      $eq: [
                        "$$serviceitem._id",
                        mongoose.Types.ObjectId(serviceId),
                      ],
                    },
                  ],
                },
              },
            },
            owner: 1,
            daysOff: {
              $filter: {
                input: "$daysOff",
                as: "dayOffItem",
                cond: {
                  $and: [
                    {
                      $eq: ["$$dayOffItem.day", Number(arrayDateFull[0])],
                    },
                    {
                      $eq: ["$$dayOffItem.month", Number(arrayDateFull[1])],
                    },
                    {
                      $eq: ["$$dayOffItem.year", Number(arrayDateFull[2])],
                    },
                  ],
                },
              },
            },
            reservationMonthTime: 1,
            reservationEveryTime: 1,
            promotions: 1,
            usersInformation: 1,
            happyHoursConst: 1,
            companyStamps: 1,
            premium: 1,
            smsReserwationAvaible: 1,
            smsNotifactionAvaible: 1,
            sms: 1,
            pauseCompany: 1,
            _id: 1,
          },
        },
        { $unwind: { path: "$workers", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$services", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            openingDays: 1,
            ownerData: {
              _id: 1,
              specialization: 1,
              user: 1,
              constantWorkingHours: 1,
              active: 1,
              permissions: 1,
              servicesCategory: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$ownerData.noConstantWorkingHours",
                  as: "itemOwner",
                  cond: {
                    $and: [
                      { $gte: ["$$itemOwner.start", resultDayMinus] },
                      { $lte: ["$$itemOwner.start", resultDayPlus] },
                    ],
                  },
                },
              },
            },
            workers: {
              _id: 1,
              specialization: 1,
              user: 1,
              constantWorkingHours: 1,
              active: 1,
              permissions: 1,
              servicesCategory: 1,
              noConstantWorkingHours: {
                $filter: {
                  input: "$workers.noConstantWorkingHours",
                  as: "item",
                  cond: {
                    $and: [
                      { $gte: ["$$item.start", resultDayMinus] },
                      { $lte: ["$$item.start", resultDayPlus] },
                    ],
                  },
                },
              },
            },
            owner: 1,
            daysOff: 1,
            reservationMonthTime: 1,
            reservationEveryTime: 1,
            services: 1,
            promotions: 1,
            usersInformation: {
              $filter: {
                input: "$usersInformation",
                as: "userInfo",
                cond: {
                  $and: [
                    {
                      $eq: [
                        "$$userInfo.userId",
                        mongoose.Types.ObjectId(userId),
                      ],
                    },
                  ],
                },
              },
            },
            happyHoursConst: 1,
            companyStamps: 1,
            premium: 1,
            smsReserwationAvaible: 1,
            smsNotifactionAvaible: 1,
            sms: 1,
            pauseCompany: 1,
            _id: 1,
          },
        },
      ])
        .then((companyDoc) => {
          if (companyDoc.length > 0) {
            const companyDocData = companyDoc[0];
            return User.findOne({
              _id: userId,
            })
              .select("_id stamps")
              .populate(
                "stamps.reserwations",
                "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company visitCanceled fullDate"
              )
              .then((resultUserDoc) => {
                if (!!resultUserDoc) {
                  let newReserwationToValid = null;
                  if (!!companyDocData.services) {
                    const splitDateStartToValid = dateStart.split(":");
                    let numberDateEnd =
                      Number(splitDateStartToValid[0]) * 60 +
                      Number(splitDateStartToValid[1]) +
                      Number(companyDocData.services.time);
                    const numberWith2Spaces = (numberDateEnd / 60).toFixed(2);
                    const splitNumberWithComa = numberWith2Spaces.split(".");
                    const otherNumberValue = numberDateEnd % 60;
                    const endDateToValidCompany = `${splitNumberWithComa[0]}:${otherNumberValue}`;
                    newReserwationToValid = new Reserwation({
                      fromUser: userId,
                      toWorkerUserId: workerUserId,
                      company: companyId,
                      dateYear: Number(arrayDateFull[2]),
                      dateMonth: Number(arrayDateFull[1]),
                      dateDay: Number(arrayDateFull[0]),
                      dateStart: dateStart,
                      dateEnd: endDateToValidCompany,
                      fullDate: actualDate,
                      workerReserwation: false,
                      isDraft: true,
                      hasCommuniting: false,
                    });
                    newReserwationDraftId = newReserwationToValid._id;
                  }
                  if (!!newReserwationToValid) {
                    return newReserwationToValid
                      .save()
                      .then((resultSavePreBooking) => {
                        let userIsBlocked = false;
                        const validUserInformation =
                          !!companyDocData.usersInformation
                            ? companyDocData.usersInformation
                            : [];
                        const isUserInUsersInformations =
                          validUserInformation.findIndex(
                            (infUser) => infUser.userId == userId
                          );

                        if (isUserInUsersInformations >= 0) {
                          userIsBlocked =
                            companyDocData.usersInformation[
                              isUserInUsersInformations
                            ].isBlocked;
                        }

                        if (isGoodTimeDate) {
                          if (!!!userIsBlocked) {
                            let selectedWorker = null;
                            if (companyDocData.owner == workerUserId) {
                              selectedWorker = companyDocData.ownerData;
                            } else {
                              if (!!companyDocData.workers) {
                                if (!!companyDocData.workers._id) {
                                  if (companyDocData.workers._id == workerId) {
                                    selectedWorker = companyDocData.workers;
                                  }
                                }
                              }
                            }
                            if (!!selectedWorker) {
                              let selectedServices = null;
                              if (companyDocData.services._id) {
                                selectedServices = companyDocData.services;
                              }
                              if (!!selectedServices) {
                                const disabledWorkerDate = [];
                                let isEmptyDate = true;

                                const arrayDateStartNewReserwation =
                                  dateStart.split(":");

                                const convertDateStartToMinNewReserwation =
                                  Number(arrayDateStartNewReserwation[0]) * 60 +
                                  Number(arrayDateStartNewReserwation[1]);

                                const dateEndNewReserwation =
                                  convertDateStartToMinNewReserwation +
                                  Number(selectedServices.time);
                                //////////////////////////////////////////////////////////////////////////

                                const selectedDate = new Date(
                                  Number(arrayDateFull[2]),
                                  Number(arrayDateFull[1]) - 1,
                                  Number(arrayDateFull[0]),
                                  10,
                                  0,
                                  0,
                                  0
                                );
                                const selectedDateDayOfTheWeek =
                                  selectedDate.getDay();
                                const selectedFullDate = `${Number(
                                  arrayDateFull[0]
                                )}-${Number(arrayDateFull[1])}-${Number(
                                  arrayDateFull[2]
                                )}`;
                                const mapWorkerConstWorkingHours =
                                  selectedWorker.constantWorkingHours.map(
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

                                const workerConstWorkingHours =
                                  mapWorkerConstWorkingHours.find(
                                    (item) =>
                                      item.dayOfTheWeek ===
                                      selectedDateDayOfTheWeek
                                  );
                                let workerNoConstWorkingHours =
                                  selectedWorker.noConstantWorkingHours.find(
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
                                    fullDate:
                                      workerNoConstWorkingHours.fullDate,
                                    holidays:
                                      workerNoConstWorkingHours.holidays,
                                    start: startDateResult,
                                    end: endDateResult,
                                  };
                                  workerNoConstWorkingHours = newDateNoConst;
                                }
                                const selectedOpenTimeDay =
                                  !!workerNoConstWorkingHours
                                    ? workerNoConstWorkingHours.holidays
                                      ? null
                                      : workerNoConstWorkingHours
                                    : workerConstWorkingHours;
                                /////////////////////////////////////////////////////////////
                                const splitOpenWorker =
                                  selectedOpenTimeDay.start.split(":");
                                const splitCloseWorker =
                                  selectedOpenTimeDay.end.split(":");

                                const convertDateStartWorkWorker =
                                  Number(splitOpenWorker[0]) * 60 +
                                  Number(splitOpenWorker[1]);

                                const convertDateEndWorkWorker =
                                  Number(splitCloseWorker[0]) * 60 +
                                  Number(splitCloseWorker[1]);

                                allReserwations.forEach((workerReserwation) => {
                                  const arrayDateStart =
                                    workerReserwation.dateStart.split(":");

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

                                disabledWorkerDate.forEach(
                                  (disabledDateItem) => {
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
                                      disabledDateItem.dateEnd <=
                                        dateEndNewReserwation;

                                    if (
                                      isStartInDate ||
                                      isEndInDate ||
                                      isStartLowerAndEndBigger
                                    ) {
                                      isEmptyDate = false;
                                    }
                                  }
                                );

                                const companyIsClose =
                                  selectedOpenTimeDay.disabled ||
                                  convertDateStartToMinNewReserwation <
                                    convertDateStartWorkWorker ||
                                  convertDateEndWorkWorker <
                                    dateEndNewReserwation;

                                const findOffDay = companyDocData.daysOff.some(
                                  (dayOff) =>
                                    dayOff.day === Number(arrayDateFull[0]) &&
                                    dayOff.month === Number(arrayDateFull[1]) &&
                                    dayOff.year === Number(arrayDateFull[2])
                                );

                                // sprawdzanie rezerwacji do przodu
                                let dateToReserwIsGood = true;
                                if (!!companyDocData.reservationMonthTime) {
                                  const maxDateToReserw = new Date(
                                    new Date().setMonth(
                                      new Date().getMonth() +
                                        companyDocData.reservationMonthTime
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
                                      if (
                                        Number(dateEndNewReserwation) % 60 ===
                                        0
                                      ) {
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
                                    const newDateConvertToValidDateDateFull =
                                      new Date(convertToValidDateDateFull);

                                    const dayNewDateConvertToValidDateDateFull =
                                      newDateConvertToValidDateDateFull.getDay();

                                    //promotions
                                    const filterSelectedPromotions =
                                      companyDocData.promotions.filter(
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

                                          const isServiceInPromotion =
                                            promotionItem.servicesInPromotion.some(
                                              (promotionItemService) =>
                                                promotionItemService ==
                                                selectedServices._id
                                            );
                                          return (
                                            isServiceInPromotion &&
                                            isDayInPromotion
                                          );
                                        }
                                      );
                                    let promotionNumber = null;

                                    if (filterSelectedPromotions.length > 0) {
                                      filterSelectedPromotions.sort((a, b) => {
                                        const firstItemToSort =
                                          a.promotionPercent;
                                        const secondItemToSort =
                                          b.promotionPercent;
                                        if (firstItemToSort < secondItemToSort)
                                          return 1;
                                        if (firstItemToSort > secondItemToSort)
                                          return -1;
                                        return 0;
                                      });

                                      promotionNumber =
                                        filterSelectedPromotions[0]
                                          .promotionPercent;
                                    }

                                    //happy hours
                                    const filterSelectedHappyHours =
                                      companyDocData.happyHoursConst.filter(
                                        (happyHourItem) => {
                                          const isSelectedDayHappyHour =
                                            happyHourItem.dayWeekIndex.some(
                                              (happyHourItemService) =>
                                                happyHourItemService ===
                                                dayNewDateConvertToValidDateDateFull
                                            );

                                          const isServiceInHappyHour =
                                            happyHourItem.servicesInPromotion.some(
                                              (happyHourItemService) =>
                                                happyHourItemService ==
                                                serviceId
                                            );
                                          const splitDateStart =
                                            happyHourItem.start.split(":");
                                          const splitDateEnd =
                                            happyHourItem.end.split(":");
                                          const dateStartToValid = new Date(
                                            new Date(
                                              newDateConvertToValidDateDateFull.setHours(
                                                Number(splitDateStart[0])
                                              )
                                            ).setMinutes(
                                              Number(splitDateStart[1])
                                            )
                                          );
                                          const dateEndToValid = new Date(
                                            new Date(
                                              newDateConvertToValidDateDateFull.setHours(
                                                Number(splitDateEnd[0])
                                              )
                                            ).setMinutes(
                                              Number(splitDateEnd[1])
                                            )
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
                                        const firstItemToSort =
                                          a.promotionPercent;
                                        const secondItemToSort =
                                          b.promotionPercent;
                                        if (firstItemToSort < secondItemToSort)
                                          return 1;
                                        if (firstItemToSort > secondItemToSort)
                                          return -1;
                                        return 0;
                                      });
                                      happyHourNumber =
                                        filterSelectedHappyHours[0]
                                          .promotionPercent;
                                    }

                                    // promotionNumber; happyHourNumber

                                    // promotion in stamp

                                    let stampNumber = null;
                                    if (
                                      !!!promotionNumber &&
                                      !!!happyHourNumber &&
                                      !!isStampActive
                                    ) {
                                      const filterCompanyStampsNoDisabled =
                                        companyDocData.companyStamps.filter(
                                          (item) => item.disabled === false
                                        );

                                      filterCompanyStampsNoDisabled.sort(
                                        (a, b) => {
                                          const firstItemToSort =
                                            a.countStampsToActive;
                                          const secondItemToSort =
                                            b.countStampsToActive;
                                          if (
                                            firstItemToSort < secondItemToSort
                                          )
                                            return -1;
                                          if (
                                            firstItemToSort > secondItemToSort
                                          )
                                            return 1;
                                          return 0;
                                        }
                                      );

                                      //was companyDoc.companyStamps <- filterCompanyStampsNoDisabled
                                      const findCompanyStamp =
                                        filterCompanyStampsNoDisabled.find(
                                          (itemStamp) => {
                                            const isInStampsService =
                                              itemStamp.servicesId.some(
                                                (stampService) =>
                                                  stampService.toString() ===
                                                  serviceId.toString()
                                              );
                                            return isInStampsService;
                                          }
                                        );

                                      if (!!findCompanyStamp) {
                                        if (!!!findCompanyStamp.disabled) {
                                          const findStampId =
                                            resultUserDoc.stamps.findIndex(
                                              (itemStamp) => {
                                                return (
                                                  itemStamp.companyId.toString() ===
                                                  companyId.toString()
                                                );
                                              }
                                            );

                                          if (findStampId >= 0) {
                                            let numberOfActiveStamps = 0;
                                            const badDateReserwations = [];
                                            const goodDateReserwations = [];

                                            resultUserDoc.stamps[
                                              findStampId
                                            ].reserwations.forEach(
                                              (stampReserwation) => {
                                                const splitDateEnd =
                                                  stampReserwation.dateEnd.split(
                                                    ""
                                                  );
                                                const reserwationStampDateEnd =
                                                  new Date(
                                                    stampReserwation.dateYear,
                                                    stampReserwation.dateMonth -
                                                      1,
                                                    stampReserwation.dateDay,
                                                    Number(splitDateEnd[0]),
                                                    Number(splitDateEnd[1])
                                                  );

                                                if (
                                                  !!!stampReserwation.visitCanceled &&
                                                  reserwationStampDateEnd <
                                                    new Date()
                                                ) {
                                                  numberOfActiveStamps =
                                                    numberOfActiveStamps + 1;
                                                  goodDateReserwations.push(
                                                    stampReserwation
                                                  );
                                                } else {
                                                  badDateReserwations.push(
                                                    stampReserwation
                                                  );
                                                }
                                              }
                                            );
                                            if (
                                              numberOfActiveStamps > 0 &&
                                              findCompanyStamp.countStampsToActive <=
                                                numberOfActiveStamps
                                            ) {
                                              goodDateReserwations.sort(
                                                (a, b) => {
                                                  const firstItemToSort =
                                                    new Date(a.fullDate);
                                                  const secondItemToSort =
                                                    new Date(b.fullDate);
                                                  if (
                                                    firstItemToSort <
                                                    secondItemToSort
                                                  )
                                                    return -1;
                                                  if (
                                                    firstItemToSort >
                                                    secondItemToSort
                                                  )
                                                    return 1;
                                                  return 0;
                                                }
                                              );
                                              stampNumber =
                                                findCompanyStamp.promotionPercent;
                                              const newGoodDateReserwation =
                                                goodDateReserwations.slice(
                                                  findCompanyStamp.countStampsToActive
                                                );
                                              const newUserReserwations = [
                                                ...badDateReserwations,
                                                ...newGoodDateReserwation,
                                              ];

                                              resultUserDoc.stamps[
                                                findStampId
                                              ].reserwations = newUserReserwations;
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
                                    const resultPriceAfterPromotion =
                                      Math.floor(
                                        (selectedServices.serviceCost *
                                          (100 - resultPromotion)) /
                                          100
                                      );

                                    return Reserwation.updateOne(
                                      {
                                        _id: newReserwationDraftId._id,
                                      },
                                      {
                                        $set: {
                                          sendSMSReserwation: false,
                                          sendSMSNotifaction: false,
                                          sendSMSCanceled: false,
                                          sendSMSChanged: false,
                                          isDraft: false,
                                          dateStart: dateStart,
                                          dateEnd: timeEndService,
                                          costReserwation:
                                            resultPriceAfterPromotion,
                                          timeReserwation:
                                            selectedServices.time,
                                          serviceName:
                                            selectedServices.serviceName,
                                          visitNotFinished: false,
                                          visitCanceled: false,
                                          visitChanged: true,
                                          extraCost: selectedServices.extraCost,
                                          extraTime: selectedServices.extraTime,
                                          reserwationMessage:
                                            reserwationMessage,
                                          workerReserwation: false,
                                          serviceId: selectedServices._id,
                                          fullDate: actualDate,
                                          activePromotion: !!promotionNumber
                                            ? true
                                            : false,
                                          activeHappyHour: !!happyHourNumber
                                            ? true
                                            : false,
                                          activeStamp: !!stampNumber
                                            ? true
                                            : false,
                                          basicPrice:
                                            selectedServices.serviceCost,
                                          isDeleted: false,
                                          oldReserwationId:
                                            selectedReserwationId,
                                        },
                                      }
                                    )
                                      .then(() => {
                                        newReserwationDraftId.isDeleted = false;
                                        newReserwationDraftId.sendSMSReserwation = false;
                                        newReserwationDraftId.sendSMSNotifaction = false;
                                        newReserwationDraftId.sendSMSCanceled = false;
                                        newReserwationDraftId.sendSMSChanged = false;
                                        newReserwationToValid.isDraft = false;
                                        newReserwationToValid.dateStart =
                                          dateStart;
                                        newReserwationToValid.dateEnd =
                                          timeEndService;
                                        newReserwationToValid.costReserwation =
                                          resultPriceAfterPromotion;
                                        newReserwationToValid.timeReserwation =
                                          selectedServices.time;
                                        newReserwationToValid.serviceName =
                                          selectedServices.serviceName;
                                        newReserwationToValid.visitNotFinished = false;
                                        newReserwationToValid.visitCanceled = false;
                                        newReserwationToValid.visitChanged = false;
                                        newReserwationToValid.extraCost =
                                          selectedServices.extraCost;
                                        newReserwationToValid.extraTime =
                                          selectedServices.extraTime;
                                        newReserwationToValid.reserwationMessage =
                                          reserwationMessage;
                                        newReserwationToValid.workerReserwation = false;
                                        newReserwationToValid.serviceId =
                                          selectedServices._id;
                                        newReserwationToValid.fullDate =
                                          actualDate;
                                        newReserwationToValid.activePromotion =
                                          !!promotionNumber ? true : false;
                                        newReserwationToValid.activeHappyHour =
                                          !!happyHourNumber ? true : false;
                                        newReserwationToValid.activeStamp =
                                          !!stampNumber ? true : false;
                                        newReserwationToValid.basicPrice =
                                          selectedServices.serviceCost;

                                        Reserwation.updateOne(
                                          {
                                            _id: selectedReserwationId,
                                          },
                                          {
                                            $set: {
                                              isDeleted: true,
                                            },
                                          }
                                        ).then(() => {});

                                        return {
                                          companyDoc: companyDocData,
                                          newReserwation: newReserwationToValid,
                                        };
                                      })
                                      .catch((err) => {
                                        Reserwation.deleteOne({
                                          _id: resultSavePreBooking._id,
                                        }).then(() => {});
                                        const error = new Error(
                                          "Błąd podczas składania rezerwacji."
                                        );
                                        error.statusCode = 420;
                                        throw error;
                                      });
                                  } else {
                                    Reserwation.deleteOne({
                                      _id: resultSavePreBooking._id,
                                    }).then(() => {});
                                    const error = new Error(
                                      "Podany termin jest zajęty."
                                    );
                                    error.statusCode = 422;
                                    throw error;
                                  }
                                } else {
                                  Reserwation.deleteOne({
                                    _id: resultSavePreBooking._id,
                                  }).then(() => {});
                                  const error = new Error(
                                    "Brak możliwości rezerwacji w podanym terminie."
                                  );
                                  error.statusCode = 422;
                                  throw error;
                                }
                              } else {
                                Reserwation.deleteOne({
                                  _id: resultSavePreBooking._id,
                                }).then(() => {});
                                const error = new Error("Brak podanej usługi.");
                                error.statusCode = 422;
                                throw error;
                              }
                            } else {
                              Reserwation.deleteOne({
                                _id: resultSavePreBooking._id,
                              }).then(() => {});
                              const error = new Error(
                                "Brak podanego pracownika."
                              );
                              error.statusCode = 422;
                              throw error;
                            }
                          } else {
                            Reserwation.deleteOne({
                              _id: resultSavePreBooking._id,
                            }).then(() => {});
                            const error = new Error(
                              "Użytkownik został zablokowany do rezerwacji w tej firmie."
                            );
                            error.statusCode = 422;
                            throw error;
                          }
                        } else {
                          Reserwation.deleteOne({
                            _id: resultSavePreBooking._id,
                          }).then(() => {});
                          const error = new Error(
                            "Nie można dokonywać rezerwacji w tym terminie."
                          );
                          error.statusCode = 422;
                          throw error;
                        }
                      })
                      .catch((err) => {
                        if (!err.statusCode) {
                          err.statusCode = 501;
                          err.message =
                            "Błąd podczas składania wstępnej rezerwacji czasu.";
                        }
                        next(err);
                      });
                  } else {
                    const error = new Error(
                      "Błąd podczas wstępnego zapisu rezerwacji."
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
              .catch((err) => {
                if (!err.statusCode) {
                  err.statusCode = 501;
                  err.message = "Błąd podczas pobieranie danych o firmie.";
                }
                next(err);
              });
          } else {
            const error = new Error(
              "Brak firmy lub konto firmowe jest nieaktywne."
            );
            error.statusCode = 419;
            throw error;
          }
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych o rezerwacjach.";
          }
          next(err);
        });
    })
    .then((result) => {
      const resultReserwation = result.newReserwation;
      return resultReserwation
        .populate(
          "reserwationId",
          "dateDay dateMonth dateYear dateStart dateEnd serviceName fromUser company"
        )
        .populate(
          {
            path: "company fromUser toWorkerUserId",
            select:
              "_id name surname linkPath smsChangedAvaible sms companyStamps",
          },
          async (err, resultReserwationPopulate) => {
            const emailContent = `Dokonano zmiany rezerwacji, nazwa usługi: ${
              resultReserwationPopulate.serviceName
            },termin: ${resultReserwationPopulate.dateDay}-${
              resultReserwationPopulate.dateMonth
            }-${resultReserwationPopulate.dateYear}, godzina: ${
              resultReserwationPopulate.dateStart
            }, czas trwania: ${resultReserwationPopulate.timeReserwation}min ${
              resultReserwationPopulate.extraTime ? "+" : ""
            }, koszt: ${resultReserwationPopulate.costReserwation} zł ${
              resultReserwationPopulate.extraCost ? "+" : ""
            }.`;

            const payload = {
              title: `Dokonano zmiany rezerwacji, nazwa usługi: ${
                resultReserwationPopulate.serviceName
              },termin: ${resultReserwationPopulate.dateDay}-${
                resultReserwationPopulate.dateMonth
              }-${resultReserwationPopulate.dateYear}, godzina: ${
                resultReserwationPopulate.dateStart
              }, czas trwania: ${
                resultReserwationPopulate.timeReserwation
              }min ${resultReserwationPopulate.extraTime ? "+" : ""}, koszt: ${
                resultReserwationPopulate.costReserwation
              } zł ${resultReserwationPopulate.extraCost ? "+" : ""}.`,
              body: "this is the body",
              icon: "images/someImageInPath.png",
            };

            const emailSubject = `Dokonano zmiany rezerwacji`;
            const message = `Dokonano zmiany rezerwacji, nazwa usługi: ${
              resultReserwationPopulate.serviceName
            },termin: ${resultReserwationPopulate.dateDay}-${
              resultReserwationPopulate.dateMonth
            }-${resultReserwationPopulate.dateYear}, godzina: ${
              resultReserwationPopulate.dateStart
            }, czas trwania: ${resultReserwationPopulate.timeReserwation}min ${
              resultReserwationPopulate.extraTime ? "+" : ""
            }, koszt: ${resultReserwationPopulate.costReserwation} zł ${
              resultReserwationPopulate.extraCost ? "+" : ""
            }.`;

            const { resultSMS } = await notifications.sendAll({
              usersId: [
                resultReserwationPopulate.fromUser._id,
                resultReserwationPopulate.toWorkerUserId._id,
              ],
              clientId: resultReserwationPopulate.fromUser._id,
              emailContent: {
                customEmail: null,
                emailTitle: emailSubject,
                emailMessage: emailContent,
              },
              notificationContent: {
                typeAlert: "reserwationId",
                dateAlert: resultReserwationPopulate,
                typeNotification: "reserwation_user_changed",
                payload: payload,
                companyChanged: false,
              },
              smsContent: {
                companyId: companyId,
                customPhone: null,
                companySendSMSValidField: "smsReserwationChangedUserAvaible",
                titleCompanySendSMS: "sms_user_changed_reserwation",
                message: message,
              },
            });

            if (!!resultSMS) {
              Reserwation.updateOne(
                {
                  _id: resultReserwationPopulate._id,
                  sendSMSReserwationUserChanged: false,
                },
                {
                  $set: {
                    sendSMSReserwationUserChanged: true,
                  },
                }
              ).then(() => {});
            }
          }
        );
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
        message: "Dokonano zmiany rezerwacji!",
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
