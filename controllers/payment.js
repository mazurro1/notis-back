const Company = require("../models/company");
const Coins = require("../models/coins");
const Invoice = require("../models/invoice");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const { createInvoice } = require("../generateInvoice");
const {
  AWS_ACCESS_KEY_ID_APP,
  AWS_SECRET_ACCESS_KEY_APP,
  AWS_REGION_APP,
  AWS_BUCKET,
  STRIPE_SECRET_KEY,
  SITE_FRONT,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_INFO,
  MAIL_PASSWORD,
} = process.env;
const AWS = require("aws-sdk");
const stripeLoader = require("stripe");
const company = require("../models/company");
const stripe = new stripeLoader(STRIPE_SECRET_KEY);
const mongoose = require("mongoose");

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: true,
  auth: {
    user: MAIL_INFO,
    pass: MAIL_PASSWORD,
  },
});

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
    .select("_id payments email customerStripeId name")
    .then((companyDoc) => {
      if (!!companyDoc) {
        return Coins.find({
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
            sessionId: session.id,
            coinsId: coinsDoc._id,
            status: "in_progress",
            buyingUserId: userId,
            productsInfo: mapItemsPayments,
            datePayment: new Date(),
          };

          return Company.updateOne(
            {
              _id: companyDoc._id,
            },
            {
              $push: {
                payments: {
                  $each: [paymentItem],
                  $position: 0,
                },
              },
            }
          )
            .then(() => {
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
  Company.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(event.data.object.metadata.companyId),
      },
    },
    {
      $project: {
        _id: 1,
        email: 1,
        name: 1,
        city: 1,
        district: 1,
        adress: 1,
        code: 1,
        nip: 1,
        payments: {
          $filter: {
            input: "$payments",
            as: "paymentsItem",
            cond: {
              $and: [
                { $eq: ["$$paymentsItem.sessionId", event.data.object.id] },
              ],
            },
          },
        },
      },
    },
  ])
    .then((companyQuery) => {
      if (companyQuery.length > 0) {
        const companyDoc = companyQuery[0];
        const findIndexPayment = companyDoc.payments.findIndex(
          (item) => item.sessionId === event.data.object.id
        );
        if (findIndexPayment >= 0) {
          const mapProductsIds = companyDoc.payments[
            findIndexPayment
          ].productsInfo.map((itemPayment) => itemPayment.coinsId);
          return Coins.find({
            _id: { $in: mapProductsIds },
          }).then((coinsDoc) => {
            if (coinsDoc.length > 0) {
              if (event.data.object.payment_status === "paid") {
                const bulkArrayToUpdate = [];

                let allCountPremium = 0;
                let allCountSMS = 0;

                bulkArrayToUpdate.push({
                  updateOne: {
                    filter: {
                      _id: companyDoc._id,
                      "payments.sessionId": event.data.object.id,
                    },
                    update: {
                      $set: {
                        "payments.$.status": event.data.object.payment_status,
                      },
                    },
                  },
                });

                coinsDoc.forEach((coinsItem) => {
                  if (!!coinsItem.countPremium) {
                    allCountPremium =
                      Number(allCountPremium) + Number(coinsItem.countPremium);
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
                      },
                      $addToSet: {
                        raportSMS: {
                          year: new Date().getFullYear(),
                          month: new Date().getMonth() + 1,
                          count: allCountSMS,
                          isAdd: true,
                        },
                      },
                    },
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
                          },
                        },
                      ],
                    },
                  });
                }

                return Company.bulkWrite(bulkArrayToUpdate)
                  .then(() => {
                    return companyDoc;
                  })
                  .catch(() => {
                    const error = new Error(
                      "Błąd podczas dodawania przedmiotów firmie."
                    );
                    error.statusCode = 422;
                    throw error;
                  });
              } else {
                Company.updateOne(
                  {
                    _id: event.data.object.metadata.companyId,
                    "payments.sessionId": event.data.object.id,
                  },
                  {
                    $set: {
                      "payments.$.status": event.data.object.payment_status,
                    },
                  }
                ).then(() => {});
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
        }
      } else {
        const error = new Error("Brak wybranej firmy.");
        error.statusCode = 411;
        throw error;
      }
    })
    .then((resultCompanyDoc) => {
      const dateInvoice = new Date();
      return Invoice.find({
        year: dateInvoice.getFullYear(),
        month: dateInvoice.getMonth() + 1,
        day: dateInvoice.getDate(),
      }).then((resultInvouices) => {
        let countAllInvoices = 0;
        if (!!resultInvouices) {
          countAllInvoices = resultInvouices.length;
        }
        const findIndexActiveInvoice = resultInvouices.findIndex(
          (item) => item.sessionId === event.data.object.id
        );
        const findIndexPayment = resultCompanyDoc.payments.findIndex(
          (item) => item.sessionId == event.data.object.id
        );
        let selectedPaymentItem = null;
        let activeInvoice = null;
        if (findIndexActiveInvoice >= 0) {
          activeInvoice = resultInvouices[findIndexActiveInvoice];
        } else {
          const newInvoiceItem = new Invoice({
            year: dateInvoice.getFullYear(),
            month: dateInvoice.getMonth() + 1,
            day: dateInvoice.getDate(),
            link: null,
            companyId: resultCompanyDoc._id,
            sessionId: event.data.object.id,
            invoiceNumber: countAllInvoices + 1,
          });
          newInvoiceItem.save();

          activeInvoice = newInvoiceItem;
        }
        if (findIndexPayment >= 0) {
          selectedPaymentItem = resultCompanyDoc.payments[findIndexPayment];
          resultCompanyDoc.payments[findIndexPayment].invoiceId =
            activeInvoice._id;

          return Company.updateOne(
            {
              _id: resultCompanyDoc._id,
              "payments.sessionId": event.data.object.id,
            },
            {
              $set: { "payments.$.invoiceId": activeInvoice._id },
            }
          ).then(() => {
            return {
              newInvoice: activeInvoice,
              resultCompanyDoc: resultCompanyDoc,
              dateInvoice: dateInvoice,
              findIndexPayment: findIndexPayment,
              selectedPaymentItem: selectedPaymentItem,
            };
          });
        }
      });
    })
    .then((resultNewInvoice) => {
      if (!!resultNewInvoice.selectedPaymentItem) {
        const unhashedAdress = Buffer.from(
          resultNewInvoice.resultCompanyDoc.adress,
          "base64"
        ).toString("ascii");

        const mapBoughtItems = resultNewInvoice.selectedPaymentItem.productsInfo.map(
          (boughtItem) => {
            return {
              name: boughtItem.name,
              count: 1,
              price: boughtItem.price,
            };
          }
        );
        const invoiceData = {
          dealer: {
            name: "FROFRONT Hubert Mazur",
            address: "Struga 18",
            code: "26-600",
            city: "Radom",
            nip: "799999999",
          },
          shipping: {
            name: resultNewInvoice.resultCompanyDoc.name,
            address: unhashedAdress,
            code: !!resultNewInvoice.resultCompanyDoc.code
              ? resultNewInvoice.resultCompanyDoc.code
              : "00-000",
            city: resultNewInvoice.resultCompanyDoc.city,
            nip: !!resultNewInvoice.resultCompanyDoc.nip
              ? resultNewInvoice.resultCompanyDoc.nip
              : "000000000",
          },
          items: mapBoughtItems,
        };
        const newInvoice = createInvoice(
          invoiceData,
          resultNewInvoice.newInvoice.invoiceNumber,
          resultNewInvoice.dateInvoice
        );
        return s3Bucket
          .upload({
            Key: `invoices/${resultNewInvoice.dateInvoice.getFullYear()}/${
              resultNewInvoice.dateInvoice.getMonth() + 1
            }/${resultNewInvoice.dateInvoice.getDate()}/${
              resultNewInvoice.resultCompanyDoc._id
            }_${resultNewInvoice.selectedPaymentItem._id}`,
            Body: newInvoice,
            ContentType: "application/pdf; charset=utf-8",
            ACL: "public-read",
          })
          .promise()
          .then((result) => {
            resultNewInvoice.newInvoice.link = result.key;
            resultNewInvoice.newInvoice.save();

            return {
              newInvoice: resultNewInvoice.newInvoice,
              resultCompanyDoc: resultNewInvoice.resultCompanyDoc,
            };
          })
          .catch((err) => {
            const error = new Error("Błąd podczas dodawania faktury.");
            error.statusCode = 412;
            throw error;
          });
      } else {
        const error = new Error(
          "Nie znaleziono sesji płatności w działalności."
        );
        error.statusCode = 422;
        throw error;
      }
    })
    .then((resultInvoice) => {
      const options = {
        Key: resultInvoice.newInvoice.link,
      };
      s3Bucket.getObject(options, (err, data) => {
        if (!err) {
          transporter.sendMail({
            to: resultInvoice.resultCompanyDoc.email,
            from: MAIL_INFO,
            subject: "Faktura vat za dokonany zakup",
            html: `<h1>Witamy</h1>
                    Przesyłamy w załączniku fakture vat za dokonane zakupy!
            `,
            attachments: [
              {
                content: data.Body,
                contentType: "application/pdf",
              },
            ],
          });
        } else {
          const error = new Error("Błąd podczas pobierania faktury.");
          error.statusCode = 425;
          throw error;
        }
      });
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
                  transporter.sendMail({
                    to: resultInvoice.companyId.email,
                    from: MAIL_INFO,
                    subject: "Faktura vat za dokonany zakup",
                    html: `<h1>Witamy</h1>
                    Przesyłamy w załączniku fakture vat za dokonane zakupy!
            `,
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
