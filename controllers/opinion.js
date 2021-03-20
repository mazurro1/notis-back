const Company = require("../models/company");
const Opinion = require("../models/opinion");
const Reserwation = require("../models/reserwation");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const io = require("../socket");

exports.addOpinion = (req, res, next) => {
  const userId = req.userId;
  const opinionData = req.body.opinionData;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Opinion.findOne({
    company: opinionData.company,
    reserwationId: opinionData.reserwationId,
  })
    .then((opinionDoc) => {
      if (!!!opinionDoc) {
        return Reserwation.findOne({
          _id: opinionData.reserwationId,
          fromUser: userId,
        })
          .select("_id opinionId")
          .then((reserwationData) => {
            if (!!reserwationData) {
              return Company.findOne({
                _id: opinionData.company,
              })
                .select("_id opinionsCount opinionsValue")
                .then((companyDoc) => {
                  if (!!companyDoc) {
                    const newOpinion = new Opinion({
                      company: opinionData.company,
                      opinionMessage: opinionData.opinionMessage,
                      opinionStars: opinionData.opinionStars,
                      replayOpinionMessage: null,
                      reserwationId: opinionData.reserwationId,
                      user: userId,
                    });
                    const validOpinionCount = !!companyDoc.opinionsCount
                      ? companyDoc.opinionsCount
                      : 0;
                    const validOpinionValue = !!companyDoc.opinionsValue
                      ? companyDoc.opinionsValue
                      : 0;
                    companyDoc.opinionsCount = Number(validOpinionCount) + 1;
                    companyDoc.opinionsValue =
                      Number(validOpinionValue) +
                      Number(opinionData.opinionStars);
                    reserwationData.opinionId = newOpinion._id;
                    companyDoc.save();
                    reserwationData.save();
                    return newOpinion.save();
                  }
                });
            } else {
              const error = new Error("Brak firmy.");
              error.statusCode = 412;
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
      resultSave
        .populate("user", "name")
        .populate({
          path: "reserwationId",
          select:
            "toWorkerUserId company dateYear dateMonth dateDay dateEnd dateStart visitNotFinished visitCanceled fromUser serviceName",
          populate: {
            path: "toWorkerUserId company fromUser",
            select: "name surname linkPath",
          },
        })
        .execPopulate()
        .then((resultPopulatedSave) => {
          if (!!resultPopulatedSave.user) {
            if (!!resultPopulatedSave.user._id) {
              User.findOne({
                _id: resultPopulatedSave.user._id,
              }).then((resultWritingOpinion) => {
                const userAlertToSave = {
                  reserwationId: resultPopulatedSave.reserwationId._id,
                  active: true,
                  type: "opinion_client",
                  creationTime: new Date(),
                  companyChanged: false,
                };

                io.getIO().emit(`user${resultWritingOpinion._id}`, {
                  action: "update-alerts",
                  alertData: {
                    reserwationId: resultPopulatedSave.reserwationId,
                    active: true,
                    type: "opinion_client",
                    creationTime: new Date(),
                    companyChanged: false,
                  },
                });
                resultWritingOpinion.alerts.unshift(userAlertToSave);
                resultWritingOpinion.save();
              });
            }
          }
          if (!!resultPopulatedSave.reserwationId) {
            if (!!resultPopulatedSave.reserwationId.toWorkerUserId) {
              if (!!resultPopulatedSave.reserwationId.toWorkerUserId._id) {
                User.findOne({
                  _id: resultPopulatedSave.reserwationId.toWorkerUserId._id,
                })
                  .select("_id alerts")
                  .then((resultToWorkerOpinion) => {
                    const userAlertToSave = {
                      reserwationId: resultPopulatedSave.reserwationId._id,
                      active: true,
                      type: "opinion_client",
                      creationTime: new Date(),
                      companyChanged: false,
                    };

                    io.getIO().emit(`user${resultToWorkerOpinion._id}`, {
                      action: "update-alerts",
                      alertData: {
                        reserwationId: resultPopulatedSave.reserwationId,
                        active: true,
                        type: "opinion_client",
                        creationTime: new Date(),
                        companyChanged: false,
                      },
                    });
                    resultToWorkerOpinion.alerts.unshift(userAlertToSave);
                    resultToWorkerOpinion.save();
                  });
              }
            }
          }

          res.status(201).json({
            opinion: resultPopulatedSave,
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

exports.updateEditedOpinion = (req, res, next) => {
  const userId = req.userId;
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
    .populate("user", "name")
    .populate({
      path: "reserwationId",
      select:
        "toWorkerUserId company dateYear dateMonth dateDay dateEnd dateStart visitNotFinished visitCanceled fromUser serviceName",
      populate: {
        path: "toWorkerUserId company fromUser",
        select: "name surname linkPath",
      },
    })
    .then((opinionDoc) => {
      if (!!opinionDoc) {
        if (!!opinionDoc.user) {
          if (!!opinionDoc.user._id) {
            User.findOne({
              _id: opinionDoc.user._id,
            }).then((resultWritingOpinion) => {
              const userAlertToSave = {
                reserwationId: opinionDoc.reserwationId._id,
                active: true,
                type: "opinion_client_edit",
                creationTime: new Date(),
                companyChanged: false,
              };

              io.getIO().emit(`user${resultWritingOpinion._id}`, {
                action: "update-alerts",
                alertData: {
                  reserwationId: opinionDoc.reserwationId,
                  active: true,
                  type: "opinion_client_edit",
                  creationTime: new Date(),
                  companyChanged: false,
                },
              });
              resultWritingOpinion.alerts.unshift(userAlertToSave);
              resultWritingOpinion.save();
            });
          }
        }
        if (!!opinionDoc.reserwationId) {
          if (!!opinionDoc.reserwationId.toWorkerUserId) {
            if (!!opinionDoc.reserwationId.toWorkerUserId._id) {
              User.findOne({
                _id: opinionDoc.reserwationId.toWorkerUserId._id,
              })
                .select("_id alerts")
                .then((resultToWorkerOpinion) => {
                  const userAlertToSave = {
                    reserwationId: opinionDoc.reserwationId._id,
                    active: true,
                    type: "opinion_client_edit",
                    creationTime: new Date(),
                    companyChanged: false,
                  };

                  io.getIO().emit(`user${resultToWorkerOpinion._id}`, {
                    action: "update-alerts",
                    alertData: {
                      reserwationId: opinionDoc.reserwationId,
                      active: true,
                      type: "opinion_client_edit",
                      creationTime: new Date(),
                      companyChanged: false,
                    },
                  });
                  resultToWorkerOpinion.alerts.unshift(userAlertToSave);
                  resultToWorkerOpinion.save();
                });
            }
          }
        }
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
        .populate("user", "name")
        .populate({
          path: "reserwationId",
          select:
            "toWorkerUserId company dateYear dateMonth dateDay dateEnd dateStart visitNotFinished visitCanceled fromUser serviceName",
          populate: {
            path: "toWorkerUserId company fromUser",
            select: "name surname linkPath",
          },
        })
        .then((resultOpinion) => {
          if (!!resultOpinion) {
            if (!!resultOpinion.user) {
              if (!!resultOpinion.user._id) {
                User.findOne({
                  _id: resultOpinion.user._id,
                }).then((resultWritingOpinion) => {
                  const userAlertToSave = {
                    reserwationId: resultOpinion.reserwationId._id,
                    active: true,
                    type: "opinion_from_company",
                    creationTime: new Date(),
                    companyChanged: false,
                  };

                  io.getIO().emit(`user${resultWritingOpinion._id}`, {
                    action: "update-alerts",
                    alertData: {
                      reserwationId: resultOpinion.reserwationId,
                      active: true,
                      type: "opinion_from_company",
                      creationTime: new Date(),
                      companyChanged: false,
                    },
                  });
                  resultWritingOpinion.alerts.unshift(userAlertToSave);
                  resultWritingOpinion.save();
                });
              }
            }
            if (!!resultOpinion.reserwationId) {
              if (!!resultOpinion.reserwationId.toWorkerUserId) {
                if (!!resultOpinion.reserwationId.toWorkerUserId._id) {
                  User.findOne({
                    _id: resultOpinion.reserwationId.toWorkerUserId._id,
                  })
                    .select("_id alerts")
                    .then((resultToWorkerOpinion) => {
                      const userAlertToSave = {
                        reserwationId: resultOpinion.reserwationId._id,
                        active: true,
                        type: "opinion_from_company",
                        creationTime: new Date(),
                        companyChanged: false,
                      };

                      io.getIO().emit(`user${resultToWorkerOpinion._id}`, {
                        action: "update-alerts",
                        alertData: {
                          reserwationId: resultOpinion.reserwationId,
                          active: true,
                          type: "opinion_from_company",
                          creationTime: new Date(),
                          companyChanged: false,
                        },
                      });
                      resultToWorkerOpinion.alerts.unshift(userAlertToSave);
                      resultToWorkerOpinion.save();
                    });
                }
              }
            }
            resultOpinion.replayOpinionMessage = replay;
            return resultOpinion.save();
          } else {
            const error = new Error("Nie znaleziono opinii.");
            error.statusCode = 403;
            throw error;
          }
        });
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
