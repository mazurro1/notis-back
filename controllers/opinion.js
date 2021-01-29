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

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        "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",
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
      res.status(201).json({
        opinion: resultSave,
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
