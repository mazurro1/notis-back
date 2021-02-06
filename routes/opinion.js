const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const opinion = require("../controllers/opinion");
const isAuth = require("../middleware/is-auth");

router.post("/add-opinion", isAuth, [body("opinionData")], opinion.addOpinion);

router.post(
  "/update-edited-opinion",
  isAuth,
  [body("opinionData")],
  opinion.updateEditedOpinion
);

router.post(
  "/load-more-opinions",
  [body("page")],
  [body("companyId")],
  opinion.loadMoreOpinions
);

router.post(
  "/add-replay-opinion",
  isAuth,
  [body("companyId")],
  [body("opinionId")],
  [body("replay").isLength({ min: 2 })],
  opinion.addReplayOpinion
);

module.exports = router;
