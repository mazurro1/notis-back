const Company = require("../models/company");
const Opinion = require("../models/opinion");
const Service = require("../models/service");
const Communiting = require("../models/Communiting");
const Reserwation = require("../models/reserwation");
const { validationResult } = require("express-validator");
const notifications = require("../middleware/notifications");

exports.addOpinion = (req, res, next) => {
  const userId = req.userId;
  const opinionData = req.body.opinionData;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  let validQuery = {};
  if (!!opinionData.reserwationId) {
    validQuery = { reserwationId: opinionData.reserwationId };
  } else if (!!opinionData.serviceId) {
    validQuery = { serviceId: opinionData.serviceId };
  } else if (!!opinionData.communitingId) {
    validQuery = { communitingId: opinionData.communitingId };
  }

  Opinion.findOne({
    company: opinionData.company,
    ...validQuery,
  })
    .then((opinionDoc) => {
      if (!!!opinionDoc) {
        const actualDate = new Date();
        const dateStartMonth = new Date(
          actualDate.getFullYear(),
          actualDate.getMonth(),
          1,
          2,
          0
        );
        const dateEndMonth = new Date(
          actualDate.getFullYear(),
          actualDate.getMonth() + 1,
          0,
          0,
          0
        );

        return Opinion.countDocuments({
          user: userId,
          createdAt: {
            $gte: dateStartMonth.toISOString(),
            $lte: dateEndMonth.toISOString(),
          },
        }).then((countOpinionMonth) => {
          if (countOpinionMonth < 10) {
            if (!!opinionData.reserwationId) {
              return Reserwation.findOne({
                _id: opinionData.reserwationId,
                fromUser: userId,
                isDeleted: { $in: [false, null] },
              })
                .select("_id opinionId")
                .then((reserwationData) => {
                  if (!!reserwationData) {
                    const newOpinion = new Opinion({
                      company: opinionData.company,
                      opinionMessage: opinionData.opinionMessage,
                      opinionStars: opinionData.opinionStars,
                      replayOpinionMessage: null,
                      reserwationId: opinionData.reserwationId,
                      user: userId,
                    });

                    reserwationData.opinionId = newOpinion._id;
                    reserwationData.save();
                    return newOpinion.save();
                  } else {
                    const error = new Error("Brak firmy.");
                    error.statusCode = 412;
                    throw error;
                  }
                });
            } else if (!!opinionData.serviceId) {
              return Service.findOne({
                _id: opinionData.serviceId,
                userId: userId,
              })
                .select("_id opinionId")
                .then((serviceData) => {
                  if (!!serviceData) {
                    const newOpinion = new Opinion({
                      company: opinionData.company,
                      opinionMessage: opinionData.opinionMessage,
                      opinionStars: opinionData.opinionStars,
                      replayOpinionMessage: null,
                      serviceId: opinionData.serviceId,
                      user: userId,
                    });
                    serviceData.opinionId = newOpinion._id;
                    serviceData.save();
                    return newOpinion.save();
                  } else {
                    const error = new Error("Brak firmy.");
                    error.statusCode = 412;
                    throw error;
                  }
                });
            } else if (!!opinionData.communitingId) {
              return Communiting.findOne({
                _id: opinionData.communitingId,
                userId: userId,
              })
                .select("_id opinionId")
                .then((communitingData) => {
                  if (!!communitingData) {
                    const newOpinion = new Opinion({
                      company: opinionData.company,
                      opinionMessage: opinionData.opinionMessage,
                      opinionStars: opinionData.opinionStars,
                      replayOpinionMessage: null,
                      communitingId: opinionData.communitingId,
                      user: userId,
                    });
                    communitingData.opinionId = newOpinion._id;
                    communitingData.save();
                    return newOpinion.save();
                  } else {
                    const error = new Error("Brak firmy.");
                    error.statusCode = 412;
                    throw error;
                  }
                });
            }
          } else {
            const error = new Error(
              "Nie można wystawić więcej niż 10 opinii w ciągu miesiąca."
            );
            error.statusCode = 440;
            throw error;
          }
        });
      } else {
        const error = new Error("Opinia jest już dodana.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then((resultSave) => {
      return Company.updateOne(
        {
          _id: resultSave.company,
        },
        {
          $inc: {
            opinionsCount: 1,
            opinionsValue: Number(opinionData.opinionStars),
          },
        }
      ).then(() => {
        return resultSave;
      });
    })
    .then(async () => {
      if (!!opinionData.reserwationId) {
        const savedOpinion = await notifications.updateAllCollection({
          companyField: "company",
          collection: "Reserwation",
          collectionItems:
            "_id visitCanceled visitChanged visitNotFinished serviceName fromUser toWorkerUserId company isDeleted oldReserwationId hasCommuniting dateYear dateMonth dateDay dateStart dateEnd fullDate costReserwation extraCost extraTime timeReserwation workerReserwation visitNotFinished visitCanceled visitChanged reserwationMessage serviceId activePromotion activeHappyHour activeStamp basicPrice opinionId isDraft sendSMSReserwation sendSMSReserwationUserChanged sendSMSNotifaction sendSMSCanceled sendSMSChanged communitingId",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: opinionData.reserwationId,
          },
          userField: "fromUser",
          workerField: "toWorkerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "reserwationId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: false,
          typeNotification: "opinion_client",
        });
        return savedOpinion[0];
      } else if (!!opinionData.serviceId) {
        const savedOpinion = await notifications.updateAllCollection({
          companyField: "companyId",
          collection: "Service",
          collectionItems:
            "_id objectName description userId companyId month year day createdAt workerUserId statusValue dateStart dateService dateEnd opinionId cost",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: opinionData.serviceId,
          },
          userField: "userId",
          workerField: "workerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "serviceId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: false,
          typeNotification: "opinion_client",
        });
        return savedOpinion[0];
      } else if (!!opinionData.communitingId) {
        const savedOpinion = await notifications.updateAllCollection({
          companyField: "companyId",
          collection: "Communiting",
          collectionItems:
            "_id cost city description userId opinionId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd fullDate statusValue city street dateStartValid dateCommunitingValid isDeleted reserwationId",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: opinionData.communitingId,
          },
          userField: "userId",
          workerField: "workerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "communitingId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: false,
          typeNotification: "opinion_client",
        });
        return savedOpinion[0];
      }
    })
    .then((resultSaved) => {
      res.status(201).json({
        opinion: resultSaved,
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

exports.updateEditedOpinion = (req, res, next) => {
  const opinionData = req.body.opinionData;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Opinion.findOne({
    company: opinionData.company,
    _id: opinionData.opinionId,
  })
    .select(
      "_id company editedOpinionMessage reserwationId serviceId communitingId"
    )
    .then((opinionDoc) => {
      if (!!opinionDoc) {
        if (!!!opinionDoc.editedOpinionMessage) {
          opinionDoc.editedOpinionMessage = opinionData.opinionEditedMessage;
          return opinionDoc.save();
        } else {
          const error = new Error("Edytowana opinia została już dodana.");
          error.statusCode = 412;
          throw error;
        }
      } else {
        const error = new Error("Brak opinii.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then(async (resultSaved) => {
      if (!!resultSaved.reserwationId) {
        await notifications.updateAllCollection({
          companyField: "company",
          collection: "Reserwation",
          collectionItems:
            "_id visitCanceled visitChanged visitNotFinished serviceName fromUser toWorkerUserId company isDeleted oldReserwationId hasCommuniting dateYear dateMonth dateDay dateStart dateEnd fullDate costReserwation extraCost extraTime timeReserwation workerReserwation visitNotFinished visitCanceled visitChanged reserwationMessage serviceId activePromotion activeHappyHour activeStamp basicPrice opinionId isDraft sendSMSReserwation sendSMSReserwationUserChanged sendSMSNotifaction sendSMSCanceled sendSMSChanged communitingId",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: opinionData.reserwationId,
          },
          userField: "fromUser",
          workerField: "toWorkerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "reserwationId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: false,
          typeNotification: "opinion_client_edit",
        });
        return true;
      } else if (!!resultSaved.serviceId) {
        await notifications.updateAllCollection({
          companyField: "companyId",
          collection: "Service",
          collectionItems:
            "_id objectName description userId companyId month year day createdAt workerUserId statusValue dateStart dateService dateEnd opinionId cost",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: opinionData.serviceId,
          },
          userField: "userId",
          workerField: "workerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "serviceId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: false,
          typeNotification: "opinion_client_edit",
        });
        return true;
      } else if (!!resultSaved.communitingId) {
        await notifications.updateAllCollection({
          companyField: "companyId",
          collection: "Communiting",
          collectionItems:
            "_id cost city description userId opinionId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd fullDate statusValue city street dateStartValid dateCommunitingValid isDeleted reserwationId",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: opinionData.communitingId,
          },
          userField: "userId",
          workerField: "workerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "communitingId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: false,
          typeNotification: "opinion_client_edit",
        });
        return true;
      }
    })
    .then(() => {
      res.status(201).json({
        message: "Dodano edytowaną opinie",
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

exports.loadMoreOpinions = (req, res, next) => {
  const page = req.body.page;
  const companyId = req.body.companyId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Opinion.find({
    company: companyId,
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
      path: "communitingId",
      select: "description workerUserId",
      populate: {
        path: "workerUserId",
        select: "name surname",
      },
    })
    .populate({
      path: "serviceId",
      select: "objectName description workerUserId",
      populate: {
        path: "workerUserId",
        select: "name surname",
      },
    })
    .skip(page * 10)
    .limit(10)
    .sort({ createdAt: -1 })
    .then((opinionDoc) => {
      const resultOpinions = !!opinionDoc ? opinionDoc : [];
      res.status(201).json({
        opinions: resultOpinions,
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

exports.addReplayOpinion = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const replay = req.body.replay;
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
    .select("_id owner")
    .then((resultCompanyDoc) => {
      if (!!resultCompanyDoc) {
        let hasPermission = resultCompanyDoc.owner == userId;
        if (hasPermission) {
          return hasPermission;
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
      return Opinion.findOne({
        _id: opinionId,
      })
        .select(
          "_id company editedOpinionMessage reserwationId serviceId communitingId"
        )
        .then((resultOpinion) => {
          if (!!resultOpinion) {
            resultOpinion.replayOpinionMessage = replay;
            return resultOpinion.save();
          } else {
            const error = new Error("Nie znaleziono opinii.");
            error.statusCode = 403;
            throw error;
          }
        });
    })
    .then(async (resultSaved) => {
      if (!!resultSaved.reserwationId) {
        await notifications.updateAllCollection({
          companyField: "company",
          collection: "Reserwation",
          collectionItems:
            "_id visitCanceled visitChanged visitNotFinished serviceName fromUser toWorkerUserId company isDeleted oldReserwationId hasCommuniting dateYear dateMonth dateDay dateStart dateEnd fullDate costReserwation extraCost extraTime timeReserwation workerReserwation visitNotFinished visitCanceled visitChanged reserwationMessage serviceId activePromotion activeHappyHour activeStamp basicPrice opinionId isDraft sendSMSReserwation sendSMSReserwationUserChanged sendSMSNotifaction sendSMSCanceled sendSMSChanged communitingId",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: resultSaved.reserwationId,
          },
          userField: "fromUser",
          workerField: "toWorkerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "reserwationId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: true,
          typeNotification: "opinion_from_company",
        });
        return true;
      } else if (!!resultSaved.serviceId) {
        await notifications.updateAllCollection({
          companyField: "companyId",
          collection: "Service",
          collectionItems:
            "_id objectName description userId companyId month year day createdAt workerUserId statusValue dateStart dateService dateEnd opinionId cost",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: resultSaved.serviceId,
          },
          userField: "userId",
          workerField: "workerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "serviceId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: true,
          typeNotification: "opinion_from_company",
        });
        return true;
      } else if (!!resultSaved.communitingId) {
        await notifications.updateAllCollection({
          companyField: "companyId",
          collection: "Communiting",
          collectionItems:
            "_id cost city description userId opinionId companyId month year day createdAt workerUserId dateEndValid timeStart timeEnd fullDate statusValue city street dateStartValid dateCommunitingValid isDeleted reserwationId",
          extraCollectionPhoneField: "phone",
          extraCollectionEmailField: "email",
          extraCollectionNameField: "name surname",
          updateCollectionItemObject: {},
          filtersCollection: {
            _id: resultSaved.communitingId,
          },
          userField: "userId",
          workerField: "workerUserId",
          sendEmailValid: true,
          notificationContent: {
            typeAlert: "communitingId",
            avaibleSendAlertToWorker: true,
          },
          smsContent: null,
          companyChanged: true,
          typeNotification: "opinion_from_company",
        });
        return true;
      }
    })
    .then(() => {
      res.status(201).json({
        message: "Dodano odpowiedz do opinii",
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
