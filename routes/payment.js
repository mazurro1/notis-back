const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const payment = require("../controllers/payment");
const isAuth = require("../middleware/is-auth");

router.post(
  "/payment-session",
  isAuth,
  [body("companyId")],
  [body("coinsIds")],
  payment.newOrderProcess
);

router.post("/update-session-payment", payment.updateOrderProcess);

router.post(
  "/send-invoice-to-company",
  isAuth,
  [body("companyId")],
  [body("invoiceId")],
  payment.sendInvoiceToCompany
);

module.exports = router;
