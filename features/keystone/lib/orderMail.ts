import { createTransport } from "nodemailer";
import { emailButton, emailItems, emailLayout, emailMuted, emailPanel, emailParagraph, emailTotals, escapeHtml } from "./email-layout";

export type OrderConfirmationEmail = {
  to: string;
  storeName: string;
  orderNumber: string;
  name: string;
  lines: Array<{ title: string; quantity: string; total: string }>;
  total: string;
  link: string;
};


function transport() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!process.env.SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email delivery is not configured");
  return createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, disableFileAccess: true, disableUrlAccess: true,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
}

export async function sendOrderConfirmationEmail(order: OrderConfirmationEmail): Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }> {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const rows = order.lines.map((line) => `<tr><td style="padding:4px 0">${escapeHtml(line.title)} × ${escapeHtml(line.quantity)}</td><td align="right" style="padding:4px 0">${escapeHtml(line.total)}</td></tr>`).join("");
    const info = await transport().sendMail({
      to: order.to,
      from: process.env.SMTP_FROM,
      subject: `Your pickup order ${order.orderNumber} at ${order.storeName}`,
      html: emailLayout({
        storeName: order.storeName,
        preheader: `Order ${order.orderNumber}`,
        title: "Your order is placed",
        body: `${emailParagraph(`Thanks ${escapeHtml(order.name)}. Order <strong>${escapeHtml(order.orderNumber)}</strong> at ${escapeHtml(order.storeName)}. Show this number at the counter when you pick it up.`)}
${emailItems(order.lines.map((line) => ({ title: line.title, quantity: line.quantity as unknown as number, amount: line.total })))}
${emailTotals([{ label: "Paid", value: order.total }])}
${emailButton("View your receipt", order.link)}`,
      }),
    });
    return { sent: true, messageId: typeof (info as any)?.messageId === "string" ? (info as any).messageId : undefined, response: typeof (info as any)?.response === "string" ? (info as any).response : undefined };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
