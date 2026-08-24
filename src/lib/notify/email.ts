import nodemailer, { type Transporter } from "nodemailer";
import { getSetting } from "@/lib/settings";

let cached: { key: string; transporter: Transporter } | null = null;

async function getTransporter() {
  const smtp = await getSetting("smtp");
  if (!smtp.enabled || !smtp.host) return null;
  const key = JSON.stringify(smtp);
  if (cached?.key === key) return cached.transporter;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
  });
  cached = { key, transporter };
  return transporter;
}

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(message: MailMessage) {
  const smtp = await getSetting("smtp");
  const transporter = await getTransporter();
  if (!transporter) {
    return { ok: false as const, error: "SMTP ist nicht konfiguriert oder deaktiviert." };
  }
  try {
    await transporter.sendMail({
      from: smtp.from,
      replyTo: smtp.replyTo || undefined,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function verifySmtp() {
  const transporter = await getTransporter();
  if (!transporter) return { ok: false as const, error: "SMTP ist nicht konfiguriert." };
  try {
    await transporter.verify();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}
