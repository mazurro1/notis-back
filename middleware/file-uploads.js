const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const MIME_TYPE_MAP = {
  // definiuje jakie roższeżenia będą akceptowane
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const fileUpload = multer({
  limits: 2000000, // ustawiamy limit np: 500 kb
  // storage: multer.diskStorage({
  //   destination: (req, file, callback) => {
  //   //   callback(null, "uploads/images"); // zapisuje zdjęcia do folderu uploads i do folderu images
  //   },
  //   filename: (req, file, callback) => {
  //     const ext = MIME_TYPE_MAP[file.mimetype];
  //     callback(null, uuidv4() + "." + ext);
  //   },
  // }),

  fileFilter: (req, file, callback) => {
    const isValid = !!MIME_TYPE_MAP[file.mimetype]; // sprawdza czy dany typ istnieje
    let error = isValid ? null : new Error("Invalid mime type!");
    callback(error, isValid);
  },
});

module.exports = fileUpload;
