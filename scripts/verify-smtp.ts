import { emailService } from "../src/libs/email";

async function main() {
  if (!emailService.isConfigured()) {
    console.error(
      "SMTP is not configured. Check the SMTP_* environment variables."
    );
    process.exitCode = 1;
    return;
  }

  const connected = await emailService.verifyConnection();
  if (!connected) process.exitCode = 1;
}

void main();
