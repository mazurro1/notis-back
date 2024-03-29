const Company = require("../models/company");
const RaportSMS = require("../models/raportSMS");
const CoinsSmsAndPremium = require("../models/coinsSmsAndPremium");
const Invoice = require("../models/invoice");
const PaymentsHistory = require("../models/PaymentsHistory");
const { validationResult } = require("express-validator");
const {
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  AWS_BUCKET,
  STRIPE_SECRET_KEY,
  SITE_FRONT,
} = process.env;
const AWS = require("aws-sdk");
const stripeLoader = require("stripe");
const stripe = new stripeLoader(STRIPE_SECRET_KEY);
const generateEmail = require("../middleware/generateContentEmail");
const notifications = require("../middleware/notifications");

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID_APP,
  secretAccessKey: AWS_SECRET_ACCESS_KEY_APP,
  region: AWS_REGION_APP,
});

const s3Bucket = new AWS.S3({
  params: {
    Bucket: AWS_BUCKET,
  },
});

exports.newOrderProcess = (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const coinsIds = req.body.coinsIds;

  Company.findOne({
    _id: companyId,
  })
    .select("_id email customerStripeId name")
    .then((companyDoc) => {
      if (!!companyDoc) {
        return CoinsSmsAndPremium.find({
          _id: { $in: coinsIds },
        }).then((coinsDoc) => {
          if (!!coinsDoc) {
            if (!!companyDoc.customerStripeId) {
              return {
                companyDoc: companyDoc,
                coinsDoc: coinsDoc,
              };
            } else {
              return stripe.customers
                .create({
                  email: companyDoc.email,
                  name: companyDoc.name,
                  metadata: {
                    companyId: companyDoc._id.toString(),
                  },
                })
                .then((customerInfo) => {
                  companyDoc.customerStripeId = customerInfo.id;
                  companyDoc.save();
                  return {
                    companyDoc: companyDoc,
                    coinsDoc: coinsDoc,
                  };
                });
            }
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
    .then(({ companyDoc, coinsDoc }) => {
      const customerIdToSession = !!companyDoc.customerStripeId
        ? { customer: companyDoc.customerStripeId }
        : { customer_email: companyDoc.email };

      let allCountSMS = 0;
      let allCountPremium = 0;

      const mapItems = coinsDoc.map((item) => {
        if (!!item.coundSMS) {
          allCountSMS = Number(allCountSMS) + Number(item.countSMS);
        }
        if (!!item.countPremium) {
          allCountPremium = Number(allCountPremium) + Number(item.countPremium);
        }
        return {
          price: item.priceId,
          quantity: 1,
        };
      });

      const mapItemsPayments = coinsDoc.map((item) => {
        return {
          coinsId: item._id,
          name: item.name,
          price: item.price,
          sms: !!item.countSMS ? item.countSMS : null,
          premium: !!item.countPremium ? item.countPremium : null,
        };
      });

      return stripe.checkout.sessions
        .create({
          payment_method_types: ["card", "p24"],
          metadata: { companyId: companyId },
          line_items: mapItems,
          mode: "payment",
          success_url: `${SITE_FRONT}`,
          cancel_url: `${SITE_FRONT}/404`,
          ...customerIdToSession,
        })
        .then((session) => {
          const paymentItem = {
            companyId: companyId,
            sessionId: session.id,
            status: "in_progress",
            buyingUserId: userId,
            productsInfo: mapItemsPayments,
            datePayment: new Date(),
            invoiceId: null,
          };

          const newPaymentHistory = new PaymentsHistory({
            ...paymentItem,
          });

          return newPaymentHistory.save();
        });
    })
    .then((paymentItem) => {
      res.status(200).json({
        paymentItem: paymentItem,
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

exports.updateOrderProcess = async (req, res, next) => {
  const event = req.body;

  Company.findOne({
    _id: event.data.object.metadata.companyId,
  })
    .select("_id email")
    .then((companyDoc) => {
      return PaymentsHistory.findOne({
        companyId: event.data.object.metadata.companyId,
        sessionId: event.data.object.id,
        // status: "in_progress",
      })
        .then((paymentHistory) => {
          if (!!paymentHistory && !!companyDoc) {
            const mapProductsIds = paymentHistory.productsInfo.map(
              (itemPayment) => itemPayment.coinsId
            );
            return CoinsSmsAndPremium.find({
              _id: { $in: mapProductsIds },
            }).then((coinsDoc) => {
              if (coinsDoc.length > 0) {
                if (event.data.object.payment_status === "paid") {
                  const bulkArrayToUpdate = [];
                  const bulkArrayToUpdateRaportSMS = [];

                  let allCountPremium = 0;
                  let allCountSMS = 0;

                  coinsDoc.forEach((coinsItem) => {
                    if (!!coinsItem.countPremium) {
                      allCountPremium =
                        Number(allCountPremium) +
                        Number(coinsItem.countPremium);
                    }
                    if (!!coinsItem.countSMS) {
                      allCountSMS =
                        Number(allCountSMS) + Number(coinsItem.countSMS);
                    }
                  });

                  if (!!allCountSMS) {
                    bulkArrayToUpdate.push({
                      updateOne: {
                        filter: {
                          _id: companyDoc._id,
                        },
                        update: {
                          $inc: { sms: allCountSMS },
                          $set: {
                            notifactionNoSMS: false,
                          },
                        },
                      },
                    });

                    bulkArrayToUpdateRaportSMS.push({
                      companyId: companyDoc._id,
                      year: new Date().getFullYear(),
                      month: new Date().getMonth() + 1,
                      count: allCountSMS,
                      isAdd: true,
                      title: "sms_added",
                    });
                  }

                  if (!!allCountPremium) {
                    const oneWeek =
                      Number(allCountPremium) * 30 * 24 * 60 * 60 * 1000;
                    bulkArrayToUpdate.push({
                      updateMany: {
                        filter: {
                          _id: companyDoc._id,
                          premium: { $exists: true },
                        },
                        update: [
                          {
                            $set: {
                              premium: { $add: ["$premium", oneWeek] },
                              notifactionNoPremium: false,
                            },
                          },
                        ],
                      },
                    });
                  }
                  return Company.bulkWrite(bulkArrayToUpdate)
                    .then(() => {
                      return RaportSMS.insertMany(
                        bulkArrayToUpdateRaportSMS
                      ).then(() => {
                        return PaymentsHistory.updateOne(
                          {
                            companyId: event.data.object.metadata.companyId,
                            sessionId: event.data.object.id,
                          },
                          {
                            $set: {
                              status: event.data.object.payment_status,
                            },
                          }
                        ).then(() => {
                          return {
                            paymentHistory: paymentHistory,
                            companyDoc: companyDoc,
                          };
                        });
                      });
                    })
                    .catch(() => {
                      const error = new Error(
                        "Błąd podczas dodawania przedmiotów firmie."
                      );
                      error.statusCode = 422;
                      throw error;
                    });
                } else {
                  PaymentsHistory.updateOne(
                    {
                      companyId: event.data.object.metadata.companyId,
                      sessionId: event.data.object.id,
                    },
                    {
                      $set: {
                        status: event.data.object.payment_status,
                      },
                    }
                  ).then(() => {
                    return {
                      paymentHistory: null,
                      companyDoc: null,
                    };
                  });

                  const error = new Error("Transakcja została odrzucona.");
                  error.statusCode = 444;
                  throw error;
                }
              } else {
                const error = new Error("Brak wybranej oferty.");
                error.statusCode = 410;
                throw error;
              }
            });
          } else {
            const error = new Error(
              "Brak wybranej firmy lub brak sesji transakcji."
            );
            error.statusCode = 411;
            throw error;
          }
        })
        .then(({ paymentHistory, companyDoc }) => {
          if (!!paymentHistory) {
            const dateInvoice = new Date();
            return Invoice.findOne({
              sessionId: event.data.object.id,
            }).then((resultInvouices) => {
              let activeInvoice = null;
              if (!!resultInvouices) {
                activeInvoice = resultInvouices;
              } else {
                const newInvoiceItem = new Invoice({
                  year: dateInvoice.getFullYear(),
                  month: dateInvoice.getMonth() + 1,
                  day: dateInvoice.getDate(),
                  link: null,
                  companyId: paymentHistory.companyId,
                  sessionId: event.data.object.id,
                  invoiceNumber: null,
                  productsInfo: paymentHistory.productsInfo,
                });
                newInvoiceItem.save();
                activeInvoice = newInvoiceItem;
              }
              return PaymentsHistory.updateOne(
                {
                  companyId: paymentHistory.companyId,
                  sessionId: event.data.object.id,
                },
                {
                  $set: { invoiceId: activeInvoice._id },
                }
              ).then(() => {
                return companyDoc;
              });
            });
          } else {
            const error = new Error("Transakcja została odrzucona.");
            error.statusCode = 422;
            throw error;
          }
        })
        .then((companyDoc) => {
          if (!!companyDoc) {
            const propsGenerator = generateEmail.generateContentEmail({
              alertType: "alert_payment_status",
              companyChanged: true,
              language: "PL",
              itemAlert: null,
              collection: "Default",
            });

            notifications.sendEmail({
              email: companyDoc.email,
              ...propsGenerator,
            });
          }
          res.json({ received: true });
        })
        .catch((err) => {
          if (!err.statusCode) {
            err.statusCode = 501;
            err.message = "Błąd podczas aktualizacji zamówienia.";
          }
          next(err);
        });
    });
};

exports.sendInvoiceToCompany = async (req, res, next) => {
  const userId = req.userId;
  const companyId = req.body.companyId;
  const invoiceId = req.body.invoiceId;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Invoice.findOne({
    _id: invoiceId,
    companyId: companyId,
  })
    .populate("companyId", "email owner")
    .then((resultInvoice) => {
      if (!!resultInvoice) {
        if (
          !!resultInvoice.companyId.owner &&
          !!resultInvoice.companyId.email
        ) {
          if (resultInvoice.companyId.owner == userId) {
            if (!!resultInvoice.link) {
              const options = {
                Key: resultInvoice.link,
              };
              s3Bucket.getObject(options, (err, data) => {
                if (!err) {
                  const propsGenerator = generateEmail.generateContentEmail({
                    alertType: "alert_payment_send_invoice",
                    companyChanged: true,
                    language: "PL",
                    itemAlert: null,
                    collection: "Default",
                  });
                  notifications.sendEmail({
                    email: resultInvoice.companyId.email,
                    ...propsGenerator,
                    attachments: [
                      {
                        content: data.Body,
                        contentType: "application/pdf",
                      },
                    ],
                  });

                  res.status(200).json({
                    message: "Wysłano wiadomość email wraz w fakturą",
                  });
                } else {
                  const error = new Error("Błąd podczas pobierania faktury.");
                  error.statusCode = 425;
                  throw error;
                }
              });
            } else {
              const error = new Error("Nie można znależć podanej faktury.");
              error.statusCode = 422;
              throw error;
            }
          } else {
            const error = new Error("Brak uprawnień.");
            error.statusCode = 422;
            throw error;
          }
        } else {
          const error = new Error("Błąd podczas pobierania działalności.");
          error.statusCode = 422;
          throw error;
        }
      } else {
        const error = new Error(
          "Nie znaleziono sesji płatności w działalności."
        );
        error.statusCode = 422;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas aktualizacji zamówienia.";
      }
      next(err);
    });
};
