const User = require("../models/user");
const Company = require("../models/company");
const CompanyAvailability = require("../models/companyAvailability");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const io = require("../socket");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { MAIL_API_KEY } = process.env;
const sendgridTransport = require("nodemailer-sendgrid-transport");
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: MAIL_API_KEY,
    },
  })
);

exports.getCompanyAvailability = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }
  CompanyAvailability.findOne({
    companyId: companyId,
  })
    .populate(
      "companyId",
      "_id workers.permissions workers.user owner promotions"
    )
    .then((companyAvailabilityDoc) => {
      let hasPermission = false;
      if (!!companyAvailabilityDoc) {
        hasPermission = companyAvailabilityDoc.companyId.owner == userId;
        if (!hasPermission) {
          const selectedWorker = companyAvailabilityDoc.companyId.workers.find(
            (worker) => worker.user == userId
          );
          if (!!selectedWorker) {
            hasPermission = selectedWorker.permissions.some(
              (perm) => perm === 1
            );
          }
        }
      }
      const companyAllAvailability = !!companyAvailabilityDoc
        ? companyAvailabilityDoc.items
        : [];
      res.status(201).json({
        availability: companyAllAvailability,
        hasPermission: hasPermission,
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

exports.addCompanyAvailability = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const itemName = req.body.itemName;
  const itemCount = req.body.itemCount;

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
              (perm) => perm === 1
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
      return CompanyAvailability.findOne({
        companyId: companyId,
      }).then((companyAvailabilityDoc) => {
        if (!!!companyAvailabilityDoc) {
          const newCompanyAvailabilit = new CompanyAvailability({
            companyId: companyId,
            items: [],
          });
          newCompanyAvailabilit.items.push({
            itemName: itemName,
            itemCount: itemCount,
          });
          return newCompanyAvailabilit.save();
        } else {
          companyAvailabilityDoc.items.push({
            itemName: itemName,
            itemCount: itemCount,
          });
          return companyAvailabilityDoc.save();
        }
      });
    })
    .then((resultSave) => {
      res.status(201).json({
        availability: resultSave.items,
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

exports.deleteCompanyAvailability = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const itemId = req.body.itemId;

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
              (perm) => perm === 1
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
      return CompanyAvailability.findOne({
        companyId: companyId,
      }).then((companyAvailabilityDoc) => {
        if (!!!companyAvailabilityDoc) {
          const error = new Error("Brak przedmiotów w magazynie.");
          error.statusCode = 422;
          throw error;
        } else {
          const filterItems = companyAvailabilityDoc.items.filter(
            (item) => item._id != itemId
          );
          companyAvailabilityDoc.items = filterItems;
          return companyAvailabilityDoc.save();
        }
      });
    })
    .then((resultSave) => {
      res.status(201).json({
        message: "Usunięto przedmiot",
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

exports.editCompanyAvailability = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const itemId = req.body.itemId;
  const itemName = req.body.itemName;
  const itemCount = req.body.itemCount;

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
              (perm) => perm === 1
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
      return CompanyAvailability.findOne({
        companyId: companyId,
      }).then((companyAvailabilityDoc) => {
        if (!!!companyAvailabilityDoc) {
          const error = new Error("Brak przedmiotów w magazynie.");
          error.statusCode = 422;
          throw error;
        } else {
          const indexItemEdited = companyAvailabilityDoc.items.findIndex(
            (item) => item._id == itemId
          );
          if (indexItemEdited >= 0) {
            companyAvailabilityDoc.items[indexItemEdited].itemName = itemName;
            companyAvailabilityDoc.items[indexItemEdited].itemCount = itemCount;
          }
          return companyAvailabilityDoc.save();
        }
      });
    })
    .then((resultSave) => {
      res.status(201).json({
        message: "Zaktualizowano przedmiot",
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
