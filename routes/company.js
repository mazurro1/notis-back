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
  "/company-users-informations-block",
  isAuth,
  [body("companyId")],
  [body("selectedUserId")],
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


router.patch(
  "/company-services-patch",
  isAuth,
  [body("companyId")],
  [body("services")],
  company.companyServicesPatch
);

router.patch(
  "/company-settings-patch",
  isAuth,
  [body("companyId")],
  [body("dataSettings")],
  company.companySettingsPatch
);

router.patch(
  "/company-workers-save-props",
  isAuth,
  [body("companyId")],
  [body("dateProps")],
  [body("constTime")],
  company.companyWorkersSaveProps
);

router.patch(
  "/company-workers-no-const-data",
  isAuth,
  [body("companyId")],
  [body("workerId")],
  [body("year")],
  [body("month")],
  company.companyWorkersNoConstData
);

router.patch(
  "/company-owner-no-const-data",
  isAuth,
  [body("companyId")],
  [body("year")],
  [body("month")],
  company.companyOwnerNoConstData
);


router.patch(
  "/company-workers-add-no-const-data",
  isAuth,
  [body("companyId")],
  [body("workerId")],
  [body("newDate")],
  company.companyWorkersAddNoConstData
);

router.patch(
  "/company-workers-delete-no-const-data",
  isAuth,
  [body("companyId")],
  [body("workerId")],
  [body("noConstDateId")],
  company.companyWorkersDeleteNoConstData
);

router.patch(
  "/company-teksts-update",
  isAuth,
  [body("companyId")],
  [body("allTextsCompany")],
  company.companyTekstsUpdate
);


module.exports = router;
