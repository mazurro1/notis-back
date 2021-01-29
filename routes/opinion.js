const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const opinion = require("../controllers/opinion");
const isAuth = require("../middleware/is-auth");

router.post("/add-opinion", isAuth, [body("opinionData")], opinion.addOpinion);

module.exports = router;
