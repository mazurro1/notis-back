const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const companyAvailability = require("../controllers/companyAvailability");
const isAuth = require("../middleware/is-auth");

router.post(
  "/get-company-availability",
  isAuth,
  [body("companyId")],
  companyAvailability.getCompanyAvailability
);

router.post(
  "/add-company-availability",
  isAuth,
  [body("companyId")],
  [body("itemName")],
  [body("itemCount")],
  companyAvailability.addCompanyAvailability
);

router.post(
  "/delete-company-availability",
  isAuth,
  [body("companyId")],
  [body("itemId")],
  companyAvailability.deleteCompanyAvailability
);

router.post(
  "/edit-company-availability",
  isAuth,
  [body("companyId")],
  [body("itemId")],
  [body("itemName")],
  [body("itemCount")],
  companyAvailability.editCompanyAvailability
);

module.exports = router;
