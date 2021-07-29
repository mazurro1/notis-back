const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const user = require("../controllers/user");
const isAuth = require("../middleware/is-auth");
const fileUpload = require("../middleware/file-uploads");
const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const {
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  SITE_FRONT,
  GOOGLE_CLIENT_ID,
  GOOGLE_APP_SECRET,
  BACKEND_URL,
} = process.env;

router.use(passport.initialize());
router.use(passport.session());

passport.use(
  new FacebookStrategy(
    {
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL: `${BACKEND_URL}/auth/facebook/callback`,
      // profileFields: ["emails", "displayName", "picture.type(large)"],
      profileFields: ["emails", "displayName"],
    },
    function (token, refreshToken, profile, done) {
      const user = {
        token: token,
        profile: profile,
      };
      return done(null, user);
    }
  )
);

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_APP_SECRET,
      callbackURL: `${BACKEND_URL}/auth/google/callback`,
      profileFields: ["emails", "displayName"],
      // "emails", "displayName", "picture.type(large)"
    },
    function (token, refreshToken, profile, done) {
      const user = {
        token: token,
        profile: profile,
      };
      return done(null, user);
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${SITE_FRONT}/404`,
  }),
  user.loginGoogle,
  function (err, req, res, next) {
    if (err) {
      res.redirect(303, `${SITE_FRONT}/404?${err}`);
    }
  }
);

router.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: "email" })
);

router.get(
  "/auth/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: `${SITE_FRONT}/404`,
  }),
  user.loginFacebookNew,
  function (err, req, res, next) {
    if (err) {
      res.redirect(303, `${SITE_FRONT}/404?${err}`);
    }
  }
);

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
  [body("newPhone")],
  [body("newPassword")],
  [body("password").trim().isLength({ min: 5 })],
  user.edit
);

router.post(
  "/sent-email-reset-password",
  [body("email").isEmail()],
  user.sentEmailResetPassword
);

router.post(
  "/reset-password",
  [body("email").isEmail()],
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

router.post(
  "/user-delete-image-other",
  isAuth,
  [body("imagePath")],
  user.userDeleteImageOther
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

router.post(
  "/user-sent-code-delete-account",
  isAuth,
  user.userSentCodeDeleteCompany
);

router.post(
  "/user-sent-code-verified-phone",
  isAuth,
  user.userSentCodeVerifiedPhone
);

router.post(
  "/delete-user-account",
  isAuth,
  [body("code")],
  user.deleteUserAccount
);

router.post(
  "/verified-user-phone",
  isAuth,
  [body("code")],
  user.verifiedUserPhone
);

router.post(
  "/save-notification-endpoint",
  isAuth,
  [body("endpoint")],
  user.saveNotificationEndpoint
);

router.post(
  "/user-update-default-company",
  isAuth,
  [body("companyId")],
  user.userUpdateDefaultCompany
);

router.post(
  "/user-history-services",
  isAuth,
  [body("month")],
  [body("year")],
  user.userHistoryServices
);

router.post(
  "/user-history-communiting",
  isAuth,
  [body("month")],
  [body("year")],
  user.userHistoryCommuniting
);

router.post(
  "/cancel-user-communiting",
  isAuth,
  [body("communityId")],
  [body("reserwationId")],
  user.userCancelCommuniting
);

router.post(
  "/download-communiting",
  [body("communitingId")],
  user.downloadCommuniting
);

router.post("/download-service", [body("serviceId")], user.downloadService);

router.post(
  "/update-user-props",
  isAuth,
  [body("language"), body("darkMode"), body("blindMode")],
  user.userUpdateProps
);

module.exports = router;
