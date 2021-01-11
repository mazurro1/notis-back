const User = require("../models/user");
const Company = require("../models/company");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator/check");
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


exports.addCompanyUsersInformationsMessage = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const workerMessage = req.body.workerMessage;
  const selectedUserId = req.body.selectedUserId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  const newMessage = {
    workerWhoWritedUserId: userId,
    message: workerMessage,
    dateMessage: new Date(),
  };

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
    .then((resultData) => {
      return CompanyUsersInformations.findOne({
        companyId: companyId,
        userId: selectedUserId,
      })
        .then((resultCompanyUserInformation) => {
          if (!!resultCompanyUserInformation) {
            resultCompanyUserInformation.messages.unshift(newMessage);
            return resultCompanyUserInformation.save();
          } else {
            const newuserCompanyInformation = new CompanyUsersInformations({
              userId: selectedUserId,
              companyId: companyId,
              messages: [],
              reserwationsCount: 0,
            });
            newuserCompanyInformation.messages.unshift(newMessage);
            return newuserCompanyInformation.save();
          }
        })
        .catch((error) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych firmowych.";
          }
          next(err);
        });
    })
    .then((userInformations) => {
     
      userInformations.populate(
        {
          path: "messages.workerWhoWritedUserId",
          select: "name surname _id",
        },
        function (err, populateMessage) {
          const addedMessage = populateMessage.messages.find(
            (message) => message.dateMessage === newMessage.dateMessage
          );
          res.status(200).json({
            message: addedMessage,
          });
        }
      );
    
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};


exports.getSelectedUsersInformationsMessage = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const userSelectedId = req.body.userSelectedId;
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
        CompanyUsersInformations.findOne({
          companyId: companyId,
          userId: userSelectedId,
        })
          .populate("messages.workerWhoWritedUserId", "name surname _id")
          .slice("messages", 10)
          .then((resultCompanyUserInformation) => {
            res.status(200).json({
              message: resultCompanyUserInformation
                ? resultCompanyUserInformation.messages
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
    })
 
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};


exports.getMoreCompanyUserInformationsMessages = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const selectedUserId = req.body.selectedUserId;
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
      CompanyUsersInformations.findOne({
        companyId: companyId,
        userId: selectedUserId,
      })
        .populate("messages.workerWhoWritedUserId", "name surname _id")
        .slice("messages", [10 * page, 10])
        .then((resultCompanyUserInformation) => {
          res.status(200).json({
            newMessages: resultCompanyUserInformation
              ? resultCompanyUserInformation.messages
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
    })

    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};


exports.deleteSelectedUsersInformationsMessage = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const selectedUserId = req.body.selectedUserId;
  const messageId = req.body.messageId;
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
      CompanyUsersInformations.findOne({
        companyId: companyId,
        userId: selectedUserId,
      })
        .then((resultCompanyUserInformation) => {
          resultCompanyUserInformation.messages.pull({ _id: messageId });
          return resultCompanyUserInformation.save();
        })
        .then(()=>{
           res.status(200).json({
             message: "Wiadomość usunięta",
           });
        })
        .catch((err => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych firmowych.";
          }
          next(err);
        }))
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas pobierania danych firmowych.";
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