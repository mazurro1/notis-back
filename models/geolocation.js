const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const geolocationSchema = new Schema({
  adress: {
    type: String,
    required: true,
  },
  lat: {
    type: Number,
    required: true,
  },
  long: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("Geolocations", geolocationSchema);
