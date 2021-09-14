const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const coins = require("../controllers/coinsSmsAndPremium");
const isAuth = require("../middleware/is-auth");

router.post(
  "/add-coins",
  // isAuth,
  // [body("countSMS")],
  // [body("price")],
  coins.addCoins
);

router.get("/get-coins-offer", coins.getCoins);

module.exports = router;
