const express = require("express");
const app = express();
const mongoose = require("mongoose");
const userRoutes = require("./routes/user");
const companyRoutes = require("./routes/company");
const paymentRoutes = require("./routes/payment");
const coinsRoutes = require("./routes/coins");
const reserwationRoutes = require("./routes/reserwation");
const availabilityRoutes = require("./routes/companyAvailability");
const opinionRoutes = require("./routes/opinion");
const { startShedule } = require("./middleware/shedule");
const cors = require("cors");
const companyUsersInformationsRoutes = require("./routes/companyUsersInformations");
const { MONGODB_PASSWORD, MONGODB_CLUSTER, MONGODB_DATABASE, MONGODB_USER } =
  process.env;
app.use(
  cors({
    credentials: true,
    orgin: true,
    // origin: [
    //   "https://api.meetsy.pl",
    //   "https://www.meetsy.pl",
    //   "https://meetsy.pl/",
    //   "https://dashboard.stripe.com/",
    // ],
    exposedHeaders: "*",
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(userRoutes);
app.use(companyRoutes);
app.use(paymentRoutes);
app.use(coinsRoutes);
app.use(reserwationRoutes);
app.use(availabilityRoutes);
app.use(opinionRoutes);
app.use(companyUsersInformationsRoutes);
app.use(startShedule);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  res.status(status).json({
    message: message,
  });
});

mongoose
  .connect(
    `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_CLUSTER}.rajb9.mongodb.net/${MONGODB_DATABASE}?retryWrites=true&w=majority`,
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then((result) => {
    const server = app.listen(3000);

    const io = require("./socket").init(server);
    io.on("connection", (socket) => {
      io.removeAllListeners();
      console.log("user connected");
    });
  })
  .catch((err) => {
    console.log(err);
  });
