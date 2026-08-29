const sgMail = require("@sendgrid/mail");
sgMail.setApiKey("SG.1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR");
module.exports = sgMail;
