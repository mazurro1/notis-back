const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const user = require("../controllers/user");
const isAuth = require("../middleware/is-auth");
const fileUpload = require("../middleware/file-uploads");

const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } = process.env;

router.post(
  "/registration",
  [
    body("email").isEmail(),
    body("password").trim().isLength({ min: 5 }),
    body("phoneNumber").trim().isLength({ min: 9 }),
    body("userName").trim().isLength({ min: 3 }),
    body("userSurname").trim().isLength({ min: 3 }),
  ],
  user.registration
);

router.post(
  "/login",
  [body("email").isEmail(), body("password").trim().isLength({ min: 5 })],
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

router.post("/update-user-alert", isAuth, user.resetAllerts);

router.post("/get-more-alerts", isAuth, [body("page")], user.getMoreAlerts);

router.post(
  "/user-upload-image",
  isAuth,
  fileUpload.single("image"),
  user.userUploadImage
);

router.post(
  "/user-delete-image",
  isAuth,
  [body("imagePath")],
  user.userDeleteImage
);

const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;

passport.use(
  new FacebookStrategy(
    {
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL: "/auth/facebook",
      profileFields: ["emails", "displayName"], // email should be in the scope.
    },
    function (accessToken, refreshToken, profile, done) {
      return done(null, profile);
    }
  )
);

router.get(
  "/auth/facebook",
  passport.authenticate("facebook", {
    scope: "email",
  }),
  user.loginFacebook
);

router.patch(
  "/add-company-favourites",
  isAuth,
  [body("companyId")],
  user.addCompanyFavourites
);

router.patch(
  "/delete-company-favourites",
  isAuth,
  [body("companyId")],
  user.deleteCompanyFavourites
);

module.exports = router;
