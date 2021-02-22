const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const company = require("../controllers/company");
const isAuth = require("../middleware/is-auth");
const getImgBuffer = require("../getImgBuffer");
const fileUpload = require("../middleware/file-uploads");

router.post(
  "/company-registration",
  isAuth,
  [body("companyEmail").isEmail()],
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
  [body("emailWorker").isEmail()],
  company.sentEmailToActiveCompanyWorker
);

router.post(
  "/sent-again-email-to-active-company-worker",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("emailWorker").isEmail()],
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
  [body("workerEmail").isEmail()],
  company.deleteWorkerFromCompany
);

router.post("/company-path", [body("companyPath").trim()], company.companyPath);

router.post(
  "/all-companys",
  [body("page").trim()],
  [body("sorts")],
  [body("filters")],
  [body("localization")],
  company.allCompanys
);

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
  "/company-workers-working-hours",
  isAuth,
  [body("companyId")],
  [body("workerId")],
  [body("year")],
  [body("month")],
  company.companyWorkersWorkingHours
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
  "/company-owner-working-hours",
  isAuth,
  [body("companyId")],
  [body("year")],
  [body("month")],
  company.companyOwnerWorkingHours
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

router.patch(
  "/company-opening-hours-update",
  isAuth,
  [body("companyId")],
  [body("openingHoursCompany")],
  company.companyOpeningHoursUpdate
);

router.patch(
  "/company-map-update",
  isAuth,
  [body("companyId")],
  [body("maps")],
  company.companyMapsUpdate
);

router.patch(
  "/add-const-date-happy-hour",
  isAuth,
  [body("companyId")],
  [body("constDate")],
  company.companyAddConstDateHappyHour
);

router.patch(
  "/add-promotion",
  isAuth,
  [body("companyId")],
  [body("promotionDate")],
  company.companyAddPromotion
);

router.patch(
  "/delete-const-date-happy-hour",
  isAuth,
  [body("companyId")],
  [body("happyHourId")],
  company.companyDeleteConstDateHappyHour
);

router.patch(
  "/update-const-date-happy-hour",
  isAuth,
  [body("companyId")],
  [body("constDate")],
  company.companyUpdateConstDateHappyHour
);

router.patch(
  "/delete-promotion",
  isAuth,
  [body("companyId")],
  [body("promotionId")],
  company.companyDeletePromotion
);

router.patch(
  "/update-promotion",
  isAuth,
  [body("companyId")],
  [body("promotionDate")],
  company.companyUpdatePromotion
);

router.post(
  "/company-upload-image",
  isAuth,
  fileUpload.single("image"),
  [body("companyId")],
  company.companyUploadImage
);

router.post(
  "/company-delete-image",
  isAuth,
  [body("companyId")],
  [body("imagePath")],
  company.companyDeleteImage
);

router.post(
  "/company-main-image",
  isAuth,
  [body("companyId")],
  [body("imagePath")],
  company.companyMainImage
);

router.post(
  "/company-add-stamp",
  isAuth,
  [body("companyId")],
  [body("disabledStamp")],
  [body("promotionPercent")],
  [body("stampCount")],
  [body("selectedServicesIds")],
  company.companyAddStamp
);

router.post(
  "/company-delete-stamp",
  isAuth,
  [body("companyId")],
  [body("stampId")],
  company.companyDeleteStamp
);

router.post(
  "/company-update-stamp",
  isAuth,
  [body("companyId")],
  [body("stampId")],
  [body("disabledStamp")],
  [body("promotionPercent")],
  [body("stampCount")],
  [body("selectedServicesIds")],
  company.companyUpdateStamp
);

router.post(
  "/edit-company-shop-store",
  isAuth,
  [body("companyId")],
  [body("newCategorys")],
  [body("editedCategory")],
  [body("deletedCategory")],
  company.companyUpdateShopStore
);

router.post(
  "/get-company-statistics",
  isAuth,
  [body("companyId")],
  [body("months")],
  [body("year")],
  company.companyStatistics
);

module.exports = router;
