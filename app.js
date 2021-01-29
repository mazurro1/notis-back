const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const userRoutes = require("./routes/user");
const companyRoutes = require("./routes/company");
const reserwationRoutes = require("./routes/reserwation");
const opinionRoutes = require("./routes/opinion");
const companyUsersInformationsRoutes = require("./routes/companyUsersInformations");

app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});
app.use(userRoutes);
app.use(companyRoutes);
app.use(reserwationRoutes);
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
    "mongodb+srv://admin:Radom1910@nootis-cluster.rajb9.mongodb.net/nootis-database?retryWrites=true&w=majority",
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
