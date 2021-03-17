const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const payment = require("../controllers/payment");
const isAuth = require("../middleware/is-auth");

router.post(
  "/payment-session",
  isAuth,
  [body("companyId")],
  [body("coinsPriceId")],
  payment.newOrderProcess
);

router.post("/update-session-payment", payment.updateOrderProcess);

module.exports = router;
