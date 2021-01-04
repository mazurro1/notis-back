const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const reserwation = require("../controllers/reserwation");
const isAuth = require("../middleware/is-auth");

router.post(
  "/add-reserwation",
  isAuth,
  [body("workerUserId")],
  [body("workerId")],
  [body("companyId")],
  [body("dateStart")],
  [body("dateEnd")],
  [body("dateFull")],
  [body("reserwationMessage")],
  [body("serviceId")],
  reserwation.addReserwation
);

router.post(
  "/add-reserwation-worker",
  isAuth,
  [body("workerUserId")],
  [body("companyId")],
  [body("dateStart")],
  [body("dateEnd")],
  [body("dateFull")],
  [body("reserwationMessage")],
  reserwation.addReserwationWorker
);

router.post(
  "/get-worker-disabled-hours",
  isAuth,
  [body("workerUserId")],
  [body("workerId")],
  [body("companyId")],
  [body("selectedDay")],
  [body("selectedMonth")],
  [body("selectedYear")],
  [body("timeReserwation")],
  reserwation.getWorkerDisabledHours
);

router.get("/user-reserwations", isAuth, reserwation.getUserReserwations);

router.post(
  "/user-reserwations-all",
  isAuth,
  [body("yearPicker")],
  [body("monthPicker")],
  reserwation.getUserReserwationsAll
);

router.post(
  "/worker-reserwations-all",
  isAuth,
  [body("workerUserId")],
  [body("yearPicker")],
  [body("monthPicker")],
  [body("companyId")],
  reserwation.getWorkerReserwationsAll
);


router.patch(
  "/update-reserwation",
  isAuth,
  [body("reserwationId")],
  [body("canceled")],
  [body("changed")],
  [body("noFinished")],
  reserwation.updateReserwation
);

router.patch(
  "/update-reserwation-worker",
  isAuth,
  [body("workerUserId")],
  [body("reserwationId")],
  [body("canceled")],
  [body("changed")],
  [body("noFinished")],
  [body("newTimeStart")],
  [body("newTimeEnd")],
  reserwation.updateWorkerReserwation
);

module.exports = router;
