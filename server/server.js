require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const APP_PORT = process.env.APP_PORT || 8000;

/**
 * Initialization!
 */

// Set up the server
const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("./public"));

const server = app.listen(APP_PORT, function () {
  console.log(`Server is up and running at http://localhost:${APP_PORT}/`);
});

// Add in all the routes
const usersRouter = require("./routes/users");
const linkTokenRouter = require("./routes/tokens");
const banksRouter = require("./routes/banks");
const transfersRouter = require("./routes/transfers");
const paymentsRouter = require("./routes/payments");
const debugRouter = require("./routes/debug");
const { getWebhookServer } = require("./webhookServer");

app.use("/server/users", usersRouter);
app.use("/server/tokens", linkTokenRouter);
app.use("/server/banks", banksRouter);
app.use("/server/transfers", transfersRouter);
app.use("/server/payments", paymentsRouter);
app.use("/server/debug", debugRouter);

/**
 * Add in some basic error handling so our server doesn't crash if we run into
 * an error.
 */
const errorHandler = function (err, req, res, next) {
  console.error(`Your error:`);
  console.error(err.response?.data);
  if (err.response?.data != null) {
    res.status(500).send(err.response.data);
  } else {
    res.status(500).send({
      error_code: "OTHER_ERROR",
      error_message: "I got some other message on the server.",
    });
    console.log(`Error object: ${JSON.stringify(err)}`);
  }
};
app.use(errorHandler);

// Let's start the webhook server while we're at it
const webhookServer = getWebhookServer();
