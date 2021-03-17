const Company = require("../models/company");
const Payment = require("../models/payment");
const Coins = require("../models/coins");
const { validationResult } = require("express-validator");
const { STRIPE_API_KEY, STRIPE_SECRET_KEY } = process.env;
const stripeLoader = require("stripe");
const stripe = new stripeLoader(STRIPE_SECRET_KEY);

exports.newOrderProcess = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const coinsId = req.body.coinsId;

  Company.findOne({
    _id: companyId,
  })
    .select("_id payments email")
    .then((companyDoc) => {
      if (!!companyDoc) {
        return Coins.findOne({
          _id: coinsId,
        }).then((coinsDoc) => {
          if (!!coinsDoc) {
            return stripe.checkout.sessions
              .create({
                payment_method_types: ["card", "p24"],
                metadata: { companyId: companyId },
                line_items: [
                  {
                    price: coinsDoc.priceId,
                    quantity: 1,
                  },
                ],
                mode: "payment",
                success_url: "http://localhost:8000/",
                cancel_url: "http://localhost:8000/404",
                customer_email: companyDoc.email,
              })
              .then((session) => {
                const paymentItem = {
                  sessionId: session.id,
                  coinsId: coinsDoc._id,
                  status: "in_progress",
                  buyingUserId: userId,
                  productName: coinsDoc.name,
                  productPrice: coinsDoc.price,
                  productMonets: coinsDoc.countCoins,
                  datePayment: new Date(),
                };
                companyDoc.payments.unshift(paymentItem);
                companyDoc.save();
                return paymentItem;
              });
          } else {
            const error = new Error("Brak wybranej oferty.");
            error.statusCode = 412;
            throw error;
          }
        });
      } else {
        const error = new Error("Brak wybranej firmy.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then((sessionPayment) => {
      res.status(200).json({
        paymentItem: sessionPayment,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas tworzenia sesji.";
      }
      next(err);
    });
};

exports.updateOrderProcess = (req, res, next) => {
  const event = req.body;

  Company.findOne({
    _id: event.data.object.metadata.companyId,
  })
    .select("_id payments monets")
    .then((companyDoc) => {
      if (!!companyDoc) {
        const findIndexPayment = companyDoc.payments.findIndex(
          (item) => item.sessionId === event.data.object.id
        );
        if (findIndexPayment >= 0) {
          return Coins.findOne({
            _id: companyDoc.payments[findIndexPayment].coinsId,
          }).then((coinsDoc) => {
            if (!!coinsDoc) {
              companyDoc.payments[findIndexPayment].status =
                event.data.object.payment_status;

              let companyOldMonets = 0;
              if (!!companyDoc.monets) {
                companyOldMonets = Buffer.from(
                  companyDoc.monets,
                  "base64"
                ).toString("ascii");
              }
              const newCompanyMonets =
                Number(companyOldMonets) + Number(coinsDoc.countCoins);

              const hashedMonets = Buffer.from(
                newCompanyMonets.toString(),
                "utf-8"
              ).toString("base64");

              companyDoc.monets = hashedMonets;

              return companyDoc.save();
            } else {
              const error = new Error("Brak wybranej oferty.");
              error.statusCode = 412;
              throw error;
            }
          });
        }
      } else {
        const error = new Error("Brak wybranej firmy.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then(() => {
      res.json({ received: true });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas aktualizacji zamówienia.";
      }
      next(err);
    });
};
