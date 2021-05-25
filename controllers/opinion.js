const Company = require("../models/company");
const Opinion = require("../models/opinion");
const Service = require("../models/service");
const Communiting = require("../models/Communiting");
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
          if (countOpinionMonth < 100) {
            if (!!opinionData.reserwationId) {
              return Reserwation.findOne({
                _id: opinionData.reserwationId,
                fromUser: userId,
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
      ).then((xd) => {
        return resultSave;
      });
    })
    .then((resultSave) => {
      let validQueruPopulateResultSave = {};
      if (!!opinionData.reserwationId) {
        validQueruPopulateResultSave = {
          path: "reserwationId",
          select:
            "toWorkerUserId company dateYear dateMonth dateDay dateEnd dateStart visitNotFinished visitCanceled fromUser serviceName",
          populate: {
            path: "toWorkerUserId company fromUser",
            select: "name surname linkPath",
          },
        };
      } else if (!!opinionData.serviceId) {
        validQueruPopulateResultSave = {
          path: "serviceId",
          select:
            "workerUserId companyId userId createdAt objectName description day month year dateStart dateEnd",
          populate: {
            path: "workerUserId companyId userId",
            select: "name surname linkPath",
          },
        };
      } else if (!!opinionData.communitingId) {
        validQueruPopulateResultSave = {
          path: "communitingId",
          select:
            "workerUserId companyId userId createdAt description city timeStart timeEnd day month year",
          populate: {
            path: "workerUserId companyId userId",
            select: "name surname linkPath",
          },
        };
      }
      resultSave
        .populate("user", "name")
        .populate(validQueruPopulateResultSave)
        .execPopulate()
        .then((resultPopulatedSave) => {
          const bulkArrayToUpdate = [];
          if (!!resultPopulatedSave.user) {
            if (!!resultPopulatedSave.user._id) {
              let validAlertItem = {};
              if (!!opinionData.reserwationId) {
                validAlertItem = {
                  reserwationId: resultPopulatedSave.reserwationId._id,
                };
              } else if (!!opinionData.serviceId) {
                validAlertItem = {
                  serviceId: resultPopulatedSave.serviceId._id,
                };
              } else if (!!opinionData.communitingId) {
                validAlertItem = {
                  communitingId: resultPopulatedSave.communitingId._id,
                };
              }

              let validAlertItemContent = {};
              if (!!opinionData.reserwationId) {
                validAlertItemContent = {
                  reserwationId: resultPopulatedSave.reserwationId,
                };
              } else if (!!opinionData.serviceId) {
                validAlertItemContent = {
                  serviceId: resultPopulatedSave.serviceId,
                };
              } else if (!!opinionData.communitingId) {
                validAlertItemContent = {
                  communitingId: resultPopulatedSave.communitingId,
                };
              }

              const userAlertToSave = {
                ...validAlertItem,
                active: true,
                type: "opinion_client",
                creationTime: new Date(),
                companyChanged: false,
              };

              io.getIO().emit(`user${resultPopulatedSave.user._id}`, {
                action: "update-alerts",
                alertData: {
                  ...validAlertItemContent,
                  active: true,
                  type: "opinion_client",
                  creationTime: new Date(),
                  companyChanged: false,
                },
              });
              bulkArrayToUpdate.push({
                updateOne: {
                  filter: { _id: resultPopulatedSave.user._id },
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
          }
          if (!!resultPopulatedSave.reserwationId) {
            if (!!resultPopulatedSave.reserwationId.toWorkerUserId) {
              if (!!resultPopulatedSave.reserwationId.toWorkerUserId._id) {
                const userAlertToSave = {
                  reserwationId: resultPopulatedSave.reserwationId._id,
                  active: true,
                  type: "opinion_client",
                  creationTime: new Date(),
                  companyChanged: false,
                };

                io.getIO().emit(
                  `user${resultPopulatedSave.reserwationId.toWorkerUserId._id}`,
                  {
                    action: "update-alerts",
                    alertData: {
                      reserwationId: resultPopulatedSave.reserwationId,
                      active: true,
                      type: "opinion_client",
                      creationTime: new Date(),
                      companyChanged: false,
                    },
                  }
                );

                bulkArrayToUpdate.push({
                  updateOne: {
                    filter: {
                      _id: resultPopulatedSave.reserwationId.toWorkerUserId._id,
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
            }
          } else if (!!resultPopulatedSave.serviceId) {
            if (!!resultPopulatedSave.serviceId.workerUserId) {
              if (!!resultPopulatedSave.serviceId.workerUserId._id) {
                const userAlertToSave = {
                  serviceId: resultPopulatedSave.serviceId._id,
                  active: true,
                  type: "opinion_client",
                  creationTime: new Date(),
                  companyChanged: false,
                };

                io.getIO().emit(
                  `user${resultPopulatedSave.serviceId.workerUserId._id}`,
                  {
                    action: "update-alerts",
                    alertData: {
                      serviceId: resultPopulatedSave.serviceId,
                      active: true,
                      type: "opinion_client",
                      creationTime: new Date(),
                      companyChanged: false,
                    },
                  }
                );

                bulkArrayToUpdate.push({
                  updateOne: {
                    filter: {
                      _id: resultPopulatedSave.serviceId.workerUserId._id,
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
            }
          } else if (!!resultPopulatedSave.communitingId) {
            if (!!resultPopulatedSave.communitingId.workerUserId) {
              if (!!resultPopulatedSave.communitingId.workerUserId._id) {
                const userAlertToSave = {
                  communitingId: resultPopulatedSave.communitingId._id,
                  active: true,
                  type: "opinion_client",
                  creationTime: new Date(),
                  companyChanged: false,
                };

                io.getIO().emit(
                  `user${resultPopulatedSave.communitingId.workerUserId._id}`,
                  {
                    action: "update-alerts",
                    alertData: {
                      communitingId: resultPopulatedSave.communitingId,
                      active: true,
                      type: "opinion_client",
                      creationTime: new Date(),
                      companyChanged: false,
                    },
                  }
                );

                bulkArrayToUpdate.push({
                  updateOne: {
                    filter: {
                      _id: resultPopulatedSave.communitingId.workerUserId._id,
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
            }
          }
          User.bulkWrite(bulkArrayToUpdate)
            .then(() => {
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
    .populate({
      path: "serviceId",
      select:
        "workerUserId companyId userId createdAt objectName description day month year dateStart dateEnd",
      populate: {
        path: "workerUserId companyId userId",
        select: "name surname linkPath",
      },
    })
    .populate({
      path: "communitingId",
      select:
        "workerUserId companyId userId createdAt description city timeStart timeEnd day month year",
      populate: {
        path: "workerUserId companyId userId",
        select: "name surname linkPath",
      },
    })
    .then((opinionDoc) => {
      if (!!opinionDoc) {
        const bulkArrayToUpdate = [];

        let validAlertItem = {};
        if (!!opinionDoc.reserwationId) {
          validAlertItem = {
            reserwationId: opinionDoc.reserwationId._id,
          };
        } else if (!!opinionDoc.serviceId) {
          validAlertItem = {
            serviceId: opinionDoc.serviceId._id,
          };
        } else if (!!opinionDoc.communitingId) {
          validAlertItem = {
            communitingId: opinionDoc.communitingId._id,
          };
        }

        let validAlertItemContent = {};
        if (!!opinionDoc.reserwationId) {
          validAlertItemContent = {
            reserwationId: opinionDoc.reserwationId,
          };
        } else if (!!opinionDoc.serviceId) {
          validAlertItemContent = {
            serviceId: opinionDoc.serviceId,
          };
        } else if (!!opinionDoc.communitingId) {
          validAlertItemContent = {
            communitingId: opinionDoc.communitingId,
          };
        }

        if (!!opinionDoc.user) {
          if (!!opinionDoc.user._id) {
            if (!!validAlertItem && !!validAlertItemContent) {
              const userAlertToSave = {
                ...validAlertItem,
                active: true,
                type: "opinion_client_edit",
                creationTime: new Date(),
                companyChanged: false,
              };

              io.getIO().emit(`user${opinionDoc.user._id}`, {
                action: "update-alerts",
                alertData: {
                  ...validAlertItemContent,
                  active: true,
                  type: "opinion_client_edit",
                  creationTime: new Date(),
                  companyChanged: false,
                },
              });

              bulkArrayToUpdate.push({
                updateOne: {
                  filter: {
                    _id: opinionDoc.user._id,
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
          }
        }

        let validWorkerId = null;
        if (!!opinionDoc.reserwationId) {
          if (!!opinionDoc.reserwationId.toWorkerUserId) {
            validWorkerId = opinionDoc.reserwationId.toWorkerUserId._id;
          }
        } else if (!!opinionDoc.serviceId) {
          if (!!opinionDoc.serviceId.workerUserId) {
            validWorkerId = opinionDoc.serviceId.workerUserId._id;
          }
        } else if (!!opinionDoc.communitingId) {
          if (!!opinionDoc.communitingId.workerUserId) {
            validWorkerId = opinionDoc.communitingId.workerUserId._id;
          }
        }

        if (!!validWorkerId) {
          const userAlertToSave = {
            ...validAlertItem,
            active: true,
            type: "opinion_client_edit",
            creationTime: new Date(),
            companyChanged: false,
          };

          io.getIO().emit(`user${validWorkerId}`, {
            action: "update-alerts",
            alertData: {
              ...validAlertItemContent,
              active: true,
              type: "opinion_client_edit",
              creationTime: new Date(),
              companyChanged: false,
            },
          });

          bulkArrayToUpdate.push({
            updateOne: {
              filter: {
                _id: validWorkerId,
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
        if (!!!opinionDoc.editedOpinionMessage) {
          return User.bulkWrite(bulkArrayToUpdate)
            .then(() => {
              opinionDoc.editedOpinionMessage =
                opinionData.opinionEditedMessage;
              return opinionDoc.save();
            })
            .catch((err) => {
              if (!err.statusCode) {
                err.statusCode = 501;
                err.message = "Błąd podczas pobierania danych.";
              }
              next(err);
            });
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
        .populate({
          path: "serviceId",
          select:
            "workerUserId companyId userId createdAt objectName description day month year dateStart dateEnd",
          populate: {
            path: "workerUserId companyId userId",
            select: "name surname linkPath",
          },
        })
        .populate({
          path: "communitingId",
          select:
            "workerUserId companyId userId createdAt description city timeStart timeEnd day month year",
          populate: {
            path: "workerUserId companyId userId",
            select: "name surname linkPath",
          },
        })
        .then((resultOpinion) => {
          if (!!resultOpinion) {
            const bulkArrayToUpdate = [];

            let validAlertItem = {};
            if (!!resultOpinion.reserwationId) {
              validAlertItem = {
                reserwationId: resultOpinion.reserwationId._id,
              };
            } else if (!!resultOpinion.serviceId) {
              validAlertItem = {
                serviceId: resultOpinion.serviceId._id,
              };
            } else if (!!resultOpinion.communitingId) {
              validAlertItem = {
                communitingId: resultOpinion.communitingId._id,
              };
            }

            let validAlertItemContent = {};
            if (!!resultOpinion.reserwationId) {
              validAlertItemContent = {
                reserwationId: resultOpinion.reserwationId,
              };
            } else if (!!resultOpinion.serviceId) {
              validAlertItemContent = {
                serviceId: resultOpinion.serviceId,
              };
            } else if (!!resultOpinion.communitingId) {
              validAlertItemContent = {
                communitingId: resultOpinion.communitingId,
              };
            }

            if (!!resultOpinion.user) {
              if (!!resultOpinion.user._id) {
                const userAlertToSave = {
                  ...validAlertItem,
                  active: true,
                  type: "opinion_from_company",
                  creationTime: new Date(),
                  companyChanged: false,
                };

                io.getIO().emit(`user${resultOpinion.user._id}`, {
                  action: "update-alerts",
                  alertData: {
                    ...validAlertItemContent,
                    active: true,
                    type: "opinion_from_company",
                    creationTime: new Date(),
                    companyChanged: false,
                  },
                });
                bulkArrayToUpdate.push({
                  updateOne: {
                    filter: {
                      _id: resultOpinion.user._id,
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
            }

            let validWorkerId = null;
            if (!!resultOpinion.reserwationId) {
              if (!!resultOpinion.reserwationId.toWorkerUserId) {
                validWorkerId = resultOpinion.reserwationId.toWorkerUserId._id;
              }
            } else if (!!resultOpinion.serviceId) {
              if (!!resultOpinion.serviceId.workerUserId) {
                validWorkerId = resultOpinion.serviceId.workerUserId._id;
              }
            } else if (!!resultOpinion.communitingId) {
              if (!!resultOpinion.communitingId.workerUserId) {
                validWorkerId = resultOpinion.communitingId.workerUserId._id;
              }
            }

            if (!!validWorkerId) {
              const userAlertToSave = {
                ...validAlertItem,
                active: true,
                type: "opinion_from_company",
                creationTime: new Date(),
                companyChanged: false,
              };

              io.getIO().emit(`user${validWorkerId}`, {
                action: "update-alerts",
                alertData: {
                  ...validAlertItemContent,
                  active: true,
                  type: "opinion_from_company",
                  creationTime: new Date(),
                  companyChanged: false,
                },
              });

              bulkArrayToUpdate.push({
                updateOne: {
                  filter: {
                    _id: validWorkerId,
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

            return User.bulkWrite(bulkArrayToUpdate)
              .then(() => {
                resultOpinion.replayOpinionMessage = replay;
                return resultOpinion.save();
              })
              .catch((err) => {
                if (!err.statusCode) {
                  err.statusCode = 501;
                  err.message = "Błąd podczas pobierania danych.";
                }
                next(err);
              });
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
