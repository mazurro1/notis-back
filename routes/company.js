const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const company = require("../controllers/company");
const isAuth = require("../middleware/is-auth");
const fileUpload = require("../middleware/file-uploads");

router.post(
  "/company-registration",
  isAuth,
  [body("companyEmail").isEmail()],
  [body("companyName").trim().isLength({ min: 3 })],
  [body("companyNumber").trim().isLength({ min: 7 })],
  [body("companyCity").trim().isLength({ min: 3 })],
  [body("companyDiscrict").trim().isLength({ min: 3 })],
  [body("companyAdress").trim().isLength({ min: 3 })],
  [body("companyIndustries")],
  [body("companyNip")],
  [body("companyAdressCode")],

  company.registrationCompany
);

router.post(
  "/company-sent-again-verification-email",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  company.sentAgainVerifiedEmailCompany
);

router.post(
  "/company-sent-again-verification-phone",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  company.sentAgainVerifiedPhoneCompany
);

router.patch(
  "/company-veryfied-email",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("codeToVerified").trim().isLength({ min: 5 })],
  company.veryfiedCompanyEmail
);

router.patch(
  "/company-veryfied-phone",
  isAuth,
  [body("companyId").trim().isLength({ min: 5 })],
  [body("codeToVerified").trim().isLength({ min: 5 })],
  company.veryfiedCompanyPhone
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
  [body("workerUserId")],
  [body("password")],

  company.deleteWorkerFromCompany
);

router.post("/company-path", [body("companyPath").trim()], company.companyPath);

router.post(
  "/all-companys",
  [body("page").trim().isNumeric()],
  [body("sorts")],
  [body("filters")],
  [body("localization")],
  [body("selectedName")],
  [body("district")],
  company.allCompanys
);

router.post(
  "/all-companys-type",
  [body("page").trim()],
  [body("type").trim()],
  [body("sorts")],
  [body("filters")],
  [body("localization")],
  [body("selectedName")],
  [body("district")],

  company.allCompanysOfType
);

router.post(
  "/all-map-marks",
  [body("type").trim()],
  [body("sorts")],
  [body("filters")],
  [body("localization")],
  [body("selectedName")],
  [body("district")],
  company.allMapMarks
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
  [body("ownerId")],

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

router.post(
  "/company-sent-code-delete-company",
  isAuth,
  [body("companyId")],
  company.companySentCodeDeleteCompany
);

router.post(
  "/company-delete-company",
  isAuth,
  [body("companyId")],
  [body("code")],
  company.companyDeleteCompany
);

router.post(
  "/company-delete-created-company",
  isAuth,
  [body("companyId")],
  company.companyDeleteCreatedCompany
);

router.post(
  "/company-history-transaction",
  isAuth,
  [body("companyId")],
  company.companyTransakcjonHistory
);

router.patch(
  "/company-sms-update",
  isAuth,
  [body("companyId")],
  [body("smsReserwationAvaible")],
  [body("smsReserwationChangedUserAvaible")],
  [body("smsNotifactionAvaible")],
  [body("smsCanceledAvaible")],
  [body("smsChangedAvaible")],

  [body("smsServiceCreatedAvaible")],
  [body("smsServiceChangedAvaible")],
  [body("smsServiceFinishedAvaible")],
  [body("smsServiceCanceledAvaible")],
  [body("smsCommunitingNotificationAvaible")],
  [body("smsCommunitingCreatedAvaible")],
  [body("smsCommunitingChangedAvaible")],
  [body("smsCommunitingCanceledAvaible")],

  company.companySMSUpdate
);

router.patch(
  "/company-sms-send-clients",
  isAuth,
  [body("companyId")],
  [body("allClients")],
  [body("selectedClients")],
  [body("textMessage")],
  company.companySMSSendClients
);

router.post("/get-geolocation", [body("address")], company.getGeolocation);

router.post("/company-marker", [body("companyId")], company.getCompanyMarker);

router.post(
  "/company-report",
  isAuth,
  [body("companyId")],
  [body("reportValue")],
  [body("opinionId")],
  company.companyReport
);

router.post(
  "/company-add-link",
  isAuth,
  [body("companyId")],
  [body("pathValue")],
  company.companyAddLink
);

router.post(
  "/company-update-nip",
  isAuth,
  [body("companyId")],
  [body("nipValue").isLength(10)],
  company.companyUpdateNip
);

router.post(
  "/company-update-nip-info",
  isAuth,
  [body("companyId")],
  company.companyUpdateNipInfo
);

router.post(
  "/company-get-services",
  isAuth,
  [body("companyId")],
  [body("year")],
  [body("month")],
  [body("workerUserId")],
  company.companyGetServices
);

router.post(
  "/company-get-communitings",
  isAuth,
  [body("companyId")],
  [body("year")],
  [body("month")],
  [body("workerUserId")],
  company.companyGetCommunitings
);

router.post(
  "/company-add-service",
  isAuth,
  [body("companyId")],
  [body("name")],
  [body("surname")],
  [body("isActiveUser")],
  [body("phone").isLength({ min: 9 })],
  [body("objectName")],
  [body("description")],
  [body("cost")],
  [body("email")],
  [body("statusValue")],
  [body("workerUserId")],
  company.companyAddService
);

router.post(
  "/company-delete-service",
  isAuth,
  [body("companyId")],
  [body("serviceId")],
  company.companyDeleteServices
);

router.post(
  "/company-update-service",
  isAuth,
  [body("companyId")],
  [body("serviceId")],
  [body("objectName")],
  [body("description")],
  [body("cost")],
  [body("statusValue")],
  [body("selectedWorkerUserId")],
  company.companyUpdateServices
);

router.post(
  "/company-get-service-user-phone",
  isAuth,
  [body("companyId")],
  [body("serviceId")],
  company.getServiceCustomUserPhone
);

router.post(
  "/company-get-communiting-user-phone",
  isAuth,
  [body("companyId")],
  [body("communitingId")],
  company.getServiceCustomUserPhoneCommuniting
);

router.post(
  "/company-add-communiting",
  isAuth,
  [body("companyId")],
  [body("name")],
  [body("surname")],
  [body("isActiveUser")],
  [body("phone").isLength({ min: 9 })],
  [body("description")],
  [body("cost")],
  [body("statusValue")],
  [body("email")],
  [body("workerUserId")],
  [body("cityInput")],
  [body("streetInput")],
  [body("timeStart")],
  [body("timeEnd")],
  [body("addWorkerTime")],
  [body("fullDate")],
  company.companyAddCommuniting
);

router.post(
  "/company-delete-communiting",
  isAuth,
  [body("companyId")],
  [body("communitingId")],
  [body("reserwationId")],
  [body("opinionId")],
  company.companyDeleteCommuniting
);

router.post(
  "/company-update-communiting",
  isAuth,
  [body("companyId")],
  [body("communitingId")],
  [body("description")],
  [body("cost")],
  [body("statusValue")],
  [body("selectedWorkerUserId")],
  [body("timeStart")],
  [body("timeEnd")],
  [body("fullDate")],
  [body("reserwationId")],
  company.companyUpdateCommuniting
);

router.post(
  "/update-company-phone",
  isAuth,
  [body("companyId"), body("newPhone"), body("password")],
  company.companyUpdatePhone
);

router.post(
  "/cancel-update-company-phone",
  isAuth,
  [body("companyId")],
  company.cancelCompanyUpdatePhone
);

router.post(
  "/update-company-phone-veryfied-code",
  isAuth,
  [body("companyId"), body("code")],
  company.companyUpdatePhoneVeryfiedCode
);

module.exports = router;
