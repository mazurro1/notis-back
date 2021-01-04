const jwt = require("jsonwebtoken");
module.exports = (req, res, next) => {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    const error = new Error("Not authentication");
    error.statusCode = 401;
    throw error;
  }
  const token = authHeader.split(" ")[1]; // pobiera 2 wartość po spacji czyli token
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, "nootisadmintoken12"); // wprowadzamy tajne hasło dzięki któremu możemy zdekodowac
  } catch (err) {
    err.statusCode = 500;
    throw err;
  }
  if (!decodedToken) {
    const error = new Error("Not authenticate");
    error.statusCode = 401;
    throw error;
  }
  req.userEmail = decodedToken.email;
  req.userId = decodedToken.userId;
  next();
};
