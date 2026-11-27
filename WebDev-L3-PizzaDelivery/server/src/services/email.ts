import nodemailer from "nodemailer";

export function canSendEmail() {
  return Boolean(process.env.SMTP_HOST && (process.env.EMAIL_FROM || process.env.SMTP_USER));
}

export async function sendEmail(message: Pick<nodemailer.SendMailOptions, "to" | "subject" | "text" | "html">) {
  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    ...message,
  });
}
