const Company = require("../models/company");
const CompanyAvailability = require("../models/companyAvailability");
const { validationResult } = require("express-validator");

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
      return CompanyAvailability.updateOne(
        {
          companyId: companyId,
        },
        {
          $pull: {
            items: { _id: itemId },
          },
        }
      )
        .then(() => {
          res.status(201).json({
            message: "Usunięto przedmiot",
          });
        })
        .catch(() => {
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
      return CompanyAvailability.updateOne(
        {
          companyId: companyId,
          "items._id": itemId,
        },
        {
          $set: {
            "items.$.itemName": itemName,
            "items.$.itemCount": itemCount,
          },
        }
      ).then(() => {
        res.status(201).json({
          message: "Zaktualizowano przedmiot",
        });
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
