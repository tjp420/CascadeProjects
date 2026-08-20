"use strict";

const logger = require("./app-logger.cjs");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(process.cwd(), ".simplebeacon", "reports");

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR))
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

async function sendReportEmail({
  recipients,
  subject,
  body,
  attachmentPath,
  attachmentName,
}) {
  ensureReportsDir();

  const mailConfig = {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "compliance@simplebeacon.local",
  };

  const hasSmtpConfig = mailConfig.host && mailConfig.user && mailConfig.pass;

  if (hasSmtpConfig) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.port === 465,
        auth: { user: mailConfig.user, pass: mailConfig.pass },
      });
      const mailOptions = {
        from: mailConfig.from,
        to: recipients.join(", "),
        subject,
        text: body,
        attachments: attachmentPath
          ? [{ filename: attachmentName, path: attachmentPath }]
          : [],
      };
      const info = await transporter.sendMail(mailOptions);
      logger.info(
        `[ReportMailer] Email sent to ${recipients.join(", ")}: ${info.messageId}`,
      );
      return { success: true, method: "smtp", messageId: info.messageId };
    } catch (err) {
      logger.error("[ReportMailer] SMTP send failed:", err.message);
      return { success: false, method: "smtp", error: err.message };
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `report-${timestamp}.json`;
  const filePath = path.join(REPORTS_DIR, filename);
  const stub = {
    from: mailConfig.from,
    to: recipients,
    subject,
    body,
    attachment: attachmentName,
    attachmentPath,
    timestamp: new Date().toISOString(),
    note: "SMTP not configured — email stub saved to disk. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable real delivery.",
  };
  fs.writeFileSync(filePath, JSON.stringify(stub, null, 2));
  logger.info(
    `[ReportMailer] Email stub saved to ${filePath} (SMTP not configured)`,
  );
  return { success: true, method: "stub", stubPath: filePath };
}

module.exports = { sendReportEmail, ensureReportsDir, REPORTS_DIR };
