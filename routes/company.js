const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const company = require("../controllers/company");
const isAuth = require("../middleware/is-auth");

router.post(
  "/company-registration",
  isAuth,
  [body("companyEmail").isEmail().normalizeEmail()],
  [body("companyName").trim().isLength({ min: 5 })],
  [body("companyNumber").trim().isLength({ min: 9 })],
  [body("companyCity").trim().isLength({ min: 3 })],
  [body("companyDiscrict").trim().isLength({ min: 3 })],
  [body("companyAdress").trim().isLength({ min: 5 })],
  [body("companyIndustries")],
  company.registrationCompany
);

router.post(
  "/company-sent-again-verification-email",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  company.sentAgainVerifiedEmailCompany
);
router.patch(
  "/company-veryfied-email",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("codeToVerified").trim().isLength({ min: 5 })],
  company.veryfiedCompanyEmail
);

router.post(
  "/company-data",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  company.getCompanyData
);

router.post(
  "/sent-email-to-active-company-worker",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("emailWorker").isEmail().normalizeEmail()],
  company.sentEmailToActiveCompanyWorker
);

router.post(
  "/sent-again-email-to-active-company-worker",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("emailWorker").isEmail().normalizeEmail()],
  company.sentAgainEmailToActiveCompanyWorker
);

router.post(
  "/confirm-added-worker-to-company",
  [body("companyId").trim().isLength({ min: 5 })],
  [body("workerEmail").trim().isLength({ min: 5 })],
  [body("codeToActive").trim().isLength({ min: 5 })],
  company.emailActiveCompanyWorker
);

router.post(
  "/delete-worker-from-company",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("workerEmail").isEmail().normalizeEmail()],
  company.deleteWorkerFromCompany
);

router.post(
  "/company-path",
  [body("companyPath").trim()],
  company.companyPath
);

router.post("/all-companys", [body("page").trim()], company.allCompanys);

router.post(
  "/all-companys-type",
  [body("page").trim()],
  [body("type").trim()],
  company.allCompanysOfType
);

router.post(
  "/get-company-users-informations",
  isAuth,
  [body("companyId")],
  company.getCompanyUsersInformations
);

router.post(
  "/get-more-users-informations-history",
  isAuth,
  [body("companyId")],
  [body("userHistoryId")],
  [body("page")],
  company.getMoreCompanyUsersInformationsHistory
);

router.post(
  "/company-users-informations-block",
  isAuth,
  [body("companyId")],
  [body("userHistoryId")],
  [body("isBlocked")],
  company.companyUsersInformationsBlock
);



router.patch(
  "/update-company-profil",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("textAboutUs")],
  [body("textRezerwation")],
  [body("ownerSpecialization")],
  [body("editedWorkers")],
  [body("editedAdress")],
  [body("editedLinks")],
  [body("openingHours")],
  [body("services")],
  [body("companyPaused")],
  [body("reservationEveryTime")],
  [body("reservationMonthTime")],
  [body("ownerSerwiceCategory")],
  [body("deletedDayOff")],
  [body("createdDayOff")],
  [body("newIndustries")],
  [body("deletedIndustries")],
  [body("editedWorkersHours")],
  company.updateCompanyProfil
);
module.exports = router;
