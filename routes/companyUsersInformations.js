const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const companyUsersInformations = require("../controllers/companyUsersInformations");
const isAuth = require("../middleware/is-auth");

router.post(
  "/add-company-users-informations-message",
  isAuth,
  [body("companyId")],
  [body("workerMessage")],
  [body("selectedUserId")],
  companyUsersInformations.addCompanyUsersInformationsMessage
);

router.post(
  "/get-selected-users-informations-message",
  isAuth,
  [body("companyId")],
  [body("userSelectedId")],
  companyUsersInformations.getSelectedUsersInformationsMessage
);

router.post(
  "/get-more-company-user-informations-messages",
  isAuth,
  [body("companyId")],
  [body("selectedUserId")],
  [body("page")],
  companyUsersInformations.getMoreCompanyUserInformationsMessages
);

router.post(
  "/delete-selected-users-informations-message",
  isAuth,
  [body("companyId")],
  [body("selectedUserId")],
  [body("messageId")],
  companyUsersInformations.deleteSelectedUsersInformationsMessage
);

module.exports = router;
