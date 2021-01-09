const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const user = require("../controllers/user");
const isAuth = require("../middleware/is-auth");

router.post(
  "/registration",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").trim().isLength({ min: 5 }),
    body("phoneNumber").trim().isLength({ min: 9 }),
    body("userName").trim().isLength({ min: 3 }),
    body("userSurname").trim().isLength({ min: 3 }),
    body("monthBirth"),
    body("dateBirth"),
  ],
  user.registration
);

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").trim().isLength({ min: 5 }),
  ],
  user.login
);

router.post(
  "/auto-login",
  [
    body("token").trim().isLength({ min: 5 }),
    body("userId").trim().isLength({ min: 5 }),
  ],
  user.autoLogin
);

router.patch(
  "/veryfied-email",
  isAuth,
  [body("codeToVerified").trim().isLength({ min: 5 })],
  user.veryfiedEmail
);

router.get("/sent-again-veryfied-email", isAuth, user.sentAgainVerifiedEmail);

router.get("/get-user-phone", isAuth, user.getUserPhone);

router.post(
  "/get-custom-user-phone",
  isAuth,
  [body("selectedUserId")],
  [body("companyId")],
  user.getCustomUserPhone
);

router.patch(
  "/edit-user",
  isAuth,
  [body("password").trim().isLength({ min: 5 })],
  user.edit
);

router.post(
  "/sent-email-reset-password",
  [body("email").isEmail().normalizeEmail()],
  user.sentEmailResetPassword
);

router.post(
  "/add-company",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  user.addCompanyId
);

router.post(
  "/reset-password",
  [body("email").isEmail().normalizeEmail()],
  [body("password").trim().isLength({ min: 5 })],
  [body("codeReset").trim().isLength({ min: 5 })],
  user.resetPassword
);

router.post(
  "/update-user-alert",
  isAuth,
  user.resetAllerts
);


router.post(
  "/get-more-alerts",
  isAuth,
  [body("page")],
  user.getMoreAlerts
);

module.exports = router;
