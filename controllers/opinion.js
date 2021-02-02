const User = require("../models/user");
const Company = require("../models/company");
const Opinion = require("../models/opinion");
const Reserwation = require("../models/reserwation");
const CompanyUsersInformations = require("../models/companyUsersInformations");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const io = require("../socket");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const { MAIL_API_KEY } = process.env;
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: MAIL_API_KEY,
    },
  })
);


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
                    const validOpinionCount = !!companyDoc.opinionsCount ? companyDoc.opinionsCount : 0;
                    const validOpinionValue = !!companyDoc.opinionsValue ? companyDoc.opinionsValue : 0;
                    companyDoc.opinionsCount = Number(validOpinionCount) + 1;
                    companyDoc.opinionsValue = Number(validOpinionValue) + Number(opinionData.opinionStars);
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
    .then(resultSave => {
      resultSave
        .populate("user", "name")
        .populate({
          path: "reserwationId",
          select: "serviceName toWorkerUserId",
          populate: {
            path: "toWorkerUserId",
            select: "name surname",
          },
        })
        .execPopulate()
        .then((resultPopulatedSave) => {
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
    .then((opinionDoc) => {
      if (!!opinionDoc) {
        if(!!!opinionDoc.editedOpinionMessage){
          opinionDoc.editedOpinionMessage = opinionData.opinionEditedMessage;
          return opinionDoc.save();
        }else{
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
  .then(()=>{
    return Opinion.findOne({
      _id: opinionId
    })
    .then(resultOpinion => {
      if (!!resultOpinion) {
        resultOpinion.replayOpinionMessage = replay;
        return resultOpinion.save();
      }else{
        const error = new Error("Nie znaleziono opinii.");
        error.statusCode = 403;
        throw error;
      }
    })
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