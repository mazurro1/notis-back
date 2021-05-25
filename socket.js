let io;
module.exports = {
  init: (httpServer) => {
    io = require("socket.io")(httpServer, {
      cors: {
        origin: ["http://localhost:8000"],
        // origin: [
        //   "https://api.meetsy.pl",
        //   "https://www.meetsy.pl",
        //   "https://meetsy.pl/",
        //   "https://dashboard.stripe.com/",
        // ],
      },
    });
    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io nie jest zainicjalizowane");
    }
    return io;
  },
};
