const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const userRoutes = require("./routes/user");
const companyRoutes = require("./routes/company");
const reserwationRoutes = require("./routes/reserwation");
const availabilityRoutes = require("./routes/companyAvailability");
const opinionRoutes = require("./routes/opinion");
const cors = require("cors");
const companyUsersInformationsRoutes = require("./routes/companyUsersInformations");
const {
  MONGODB_PASSWORD,
  MONGODB_CLUSTER,
  MONGODB_DATABASE,
  MONGODB_USER,
} = process.env;
app.use(
  cors({
    credentials: true,
    orgin: true,
    // origin: [
    //   "https://api.nootis.pl",
    //   "https://www.nootis.pl",
    //   "https://nootis.pl/",
    // ],
    exposedHeaders: "*",
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(bodyParser.json());
app.use(userRoutes);
app.use(companyRoutes);
app.use(reserwationRoutes);
app.use(availabilityRoutes);
app.use(opinionRoutes);
app.use(companyUsersInformationsRoutes);

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
