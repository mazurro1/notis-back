const Company = require("../models/company");
const Coins = require("../models/coins");
const { validationResult } = require("express-validator");
const { STRIPE_API_KEY, STRIPE_SECRET_KEY } = process.env;
const stripeLoader = require("stripe");
const stripe = new stripeLoader(STRIPE_SECRET_KEY);

exports.addCoins = (req, res, next) => {
  // const userId = req.userId;
  const userCreated = req.body.userCreated;
  const productId = req.body.productId;
  const priceId = req.body.priceId;
  const price = req.body.price;
  const countCoins = req.body.countCoins;
  const name = req.body.name;
  const description = req.body.description;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Coins.findOne({
    productId: productId,
    priceId: priceId,
  })
    .then((coinsDoc) => {
      if (!!!coinsDoc) {
        const newCoins = new Coins({
          productId: productId,
          priceId: priceId,
          price: price,
          countCoins: countCoins,
          name: name,
          description: description,
          userCreated: userCreated,
        });
        return newCoins.save();
      } else {
        const error = new Error("Podobna oferta już istnieje.");
        error.statusCode = 412;
        throw error;
      }
    })
    .then(() => {
      res.status(200).json({
        message: "Oferta utworzona",
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};

exports.getCoins = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation faild entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  Coins.find({
    disabled: false,
  })
    .select("-userCreated")
    .then((coinsDoc) => {
      if (!!coinsDoc) {
        res.status(200).json({
          coinsOffer: coinsDoc,
        });
      } else {
        const error = new Error("Brak ofert.");
        error.statusCode = 412;
        throw error;
      }
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 501;
        err.message = "Błąd podczas pobierania danych.";
      }
      next(err);
    });
};
