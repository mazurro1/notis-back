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
const stripe = new stripeLoader(STRIPE_SECRET_KEY);

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
                success_url: `${SITE_FRONT}`,
                cancel_url: `${SITE_FRONT}/404`,
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

exports.updateOrderProcess = async (req, res, next) => {
  const event = req.body;

  Company.findOne({
    _id: event.data.object.metadata.companyId,
  })
    .select("_id payments monets email name city district adress")
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
              if (event.data.object.payment_status === "paid") {
                companyDoc.payments[findIndexPayment].status =
                  event.data.object.payment_status;

                let companyOldMonets = 0;
                if (!!companyDoc.monets) {
                  companyOldMonets = Buffer.from(
                    companyDoc.monets,
                    "base64"
                  ).toString("ascii");
                }
                const newCompanyMonets = `${
                  Number(companyOldMonets) + Number(coinsDoc.countCoins)
                }`;

                const hashedMonets = Buffer.from(
                  newCompanyMonets,
                  "utf-8"
                ).toString("base64");

                companyDoc.monets = hashedMonets;

                return companyDoc.save();
              } else {
                companyDoc.payments[findIndexPayment].status =
                  event.data.object.payment_status;
                companyDoc.save();
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
        }
        resultCompanyDoc.save();
        return {
          newInvoice: activeInvoice,
          resultCompanyDoc: resultCompanyDoc,
          dateInvoice: dateInvoice,
          findIndexPayment: findIndexPayment,
          selectedPaymentItem: selectedPaymentItem,
        };
      });
    })
    .then((resultNewInvoice) => {
      if (!!resultNewInvoice.selectedPaymentItem) {
        const unhashedAdress = Buffer.from(
          resultNewInvoice.resultCompanyDoc.adress,
          "base64"
        ).toString("ascii");
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
          items: [
            {
              name: resultNewInvoice.selectedPaymentItem.productName,
              count: 1,
              price: resultNewInvoice.selectedPaymentItem.productPrice,
            },
          ],
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
          console.log(err);
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
