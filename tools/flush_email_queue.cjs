#!/usr/bin/env node
// simplebeacon-ignore credentials — operational tool, logs masked env vars only
// Flush queued emails from .simplebeacon/email-queue by calling project's sendEmail()
// Usage: node tools/flush_email_queue.cjs [--limit=N] [--dry-run]

const path = require("path");
const fs = require("fs").promises;
const { readdirSync } = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const EMAIL_QUEUE_DIR = path.join(
  process.cwd(),
  ".simplebeacon",
  "email-queue",
);
let sendEmail; // required later after any CLI env overrides so module sees correct env

async function listQueueFiles() {
  try {
    const files = readdirSync(EMAIL_QUEUE_DIR).filter(
      (f) => f.startsWith("email_") && f.endsWith(".json"),
    );
    files.sort((a, b) => {
      const aStat = fs.statSync
        ? fs.statSync(path.join(EMAIL_QUEUE_DIR, a))
        : null;
      const bStat = fs.statSync
        ? fs.statSync(path.join(EMAIL_QUEUE_DIR, b))
        : null;
      if (!aStat || !bStat) return 0;
      return bStat.mtimeMs - aStat.mtimeMs;
    });
    return files.map((f) => path.join(EMAIL_QUEUE_DIR, f));
  } catch (err) {
    return [];
  }
}

async function flush() {
  const dryRun = argv["dry-run"] || argv.dryRun || false;
  const limit = Number(argv.limit) || Number(argv.l) || 0;

  // CLI overrides: allow explicit smtp port and resend key to be passed on command line
  const smtpPortArg = argv["smtp-port"] || argv["smtpPort"];
  const resendKeyArg = argv["resend-key"] || argv["resendKey"];
  if (smtpPortArg) process.env.SMTP_PORT = String(smtpPortArg);
  if (resendKeyArg) process.env.RESEND_API_KEY = String(resendKeyArg);

  // Mask helper for logging secrets
  function maskSecret(s) {
    if (!s) return "<none>";
    if (s.length <= 8) return "****";
    return `${s.slice(0, 4)}...${s.slice(-4)}`;
  }

  // Require the email service after applying overrides so it picks up env changes
  try {
    sendEmail = require(
      path.join(
        __dirname,
        "..",
        "ai-platform",
        "server",
        "lib",
        "email-service.cjs",
      ),
    ).sendEmail;
  } catch (e) {
    console.error("Failed to load email-service module:", String(e));
    process.exit(2);
  }

  console.log(
    "Effective delivery config: SMTP_HOST=",
    process.env.SMTP_HOST || "<none>",
    "SMTP_PORT=",
    process.env.SMTP_PORT || "<none>",
    "RESEND_API_KEY=",
    maskSecret(process.env.RESEND_API_KEY),
  ); // simplebeacon-ignore credentials — false positive, API key is masked before logging

  // Safety: require explicit confirmation for live runs (non-dry-run)
  if (!dryRun && !(argv.yes || argv.y)) {
    console.log(
      "This run will perform LIVE sends. Re-run with --yes to proceed, or use --dry-run to preview.",
    );
    return;
  }
  console.log("Queue dir:", EMAIL_QUEUE_DIR);
  const files = await listQueueFiles();
  if (!files.length) {
    console.log("No queued emails found.");
    return;
  }
  const toProcess = limit > 0 ? files.slice(0, limit) : files;
  console.log(
    `Found ${files.length} queued emails; processing ${toProcess.length}`,
  );
  for (const filePath of toProcess) {
    console.log("\nProcessing", filePath);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const payload = JSON.parse(raw);
      const { to, subject, text, html, attachments } = payload;
      console.log("Message preview -> to:", to, "subject:", subject);
      if (dryRun) continue;

      // Move file to a temporary processing name to avoid duplicate concurrent work
      const sendingPath = filePath + ".sending";
      try {
        await fs.rename(filePath, sendingPath);
      } catch (renameErr) {
        console.error("flush_email_queue.cjs error:", renameErr);
        // If rename fails because file was removed, skip
        console.warn(
          "Warning: failed to rename queued file, skipping:",
          filePath,
          String(renameErr),
        );
        continue;
      }

      try {
        const res = await sendEmail({ to, subject, text, html, attachments });
        console.log("Send result:", res);
        if (res && res.sent) {
          // sent successfully — remove the processing file
          try {
            await fs.unlink(sendingPath);
          } catch (e) {
            /* ignore */ console.warn(
              "[flush_email_queue] swallowed error:",
              e,
            );
          }
          console.log("Deleted queued file after successful send:", filePath);
        } else if (res && res.queued) {
          // Provider re-queued — write back to original path (overwrite) and remove provider-created duplicate if present
          try {
            payload.queuedAt = new Date().toISOString();
            payload._provider = res.provider || "queued";
            await fs.writeFile(
              filePath,
              JSON.stringify(payload, null, 2) + "\n",
              "utf8",
            );
            // If provider returned a queuePath, attempt to remove it to avoid duplicates
            if (res.queuePath) {
              try {
                await fs.unlink(res.queuePath);
              } catch (e) {
                /* ignore */ console.warn(
                  "[flush_email_queue] swallowed error:",
                  e,
                );
              }
            }
            try {
              await fs.unlink(sendingPath);
            } catch (e) {
              /* ignore */ console.warn(
                "[flush_email_queue] swallowed error:",
                e,
              );
            }
            console.log(
              "Rewrote original queued file after provider queued it:",
              filePath,
            );
          } catch (writeErr) {
            console.error("flush_email_queue.cjs error:", writeErr);
            // Attempt to recover: move sendingPath back to original
            try {
              await fs.rename(sendingPath, filePath);
            } catch (e) {
              /* ignore */ console.warn(
                "[flush_email_queue] swallowed error:",
                e,
              );
            }
            console.error(
              "Failed to write back queued file, restored original:",
              String(writeErr),
            );
          }
        } else {
          // Not sent and not queued — restore original file
          try {
            await fs.rename(sendingPath, filePath);
          } catch (e) {
            /* ignore */ console.warn(
              "[flush_email_queue] swallowed error:",
              e,
            );
          }
          console.log(
            "Not sent:",
            res && res.error ? res.error : JSON.stringify(res),
          );
        }
      } catch (err) {
        console.error("flush_email_queue.cjs error:", err);
        // On error calling sendEmail, restore original queue file so it isn't lost
        try {
          await fs.rename(sendingPath, filePath);
        } catch (e) {
          /* ignore */ console.warn("[flush_email_queue] swallowed error:", e);
        }
        console.error(
          "Failed sending queued email:",
          err && err.message ? err.message : String(err),
        );
      }
    } catch (err) {
      console.error("Failed to read or parse queued file:", String(err));
    }
  }
}

flush().catch((e) => {
  console.error("Flush failed:", (e && e.stack) || e);
  process.exit(2);
});
