import { createTransport } from "nodemailer";

export type OrderConfirmationEmail = {
  to: string;
  storeName: string;
  orderNumber: string;
  name: string;
  lines: Array<{ title: string; quantity: string; total: string }>;
  total: string;
  link: string;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

function transport() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!process.env.SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email delivery is not configured");
  return createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, disableFileAccess: true, disableUrlAccess: true,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
}

export async function sendOrderConfirmationEmail(order: OrderConfirmationEmail): Promise<{ sent: boolean; error?: string }> {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const rows = order.lines.map((line) => `<tr><td style="padding:4px 0">${escapeHtml(line.title)} × ${escapeHtml(line.quantity)}</td><td align="right" style="padding:4px 0">${escapeHtml(line.total)}</td></tr>`).join("");
    await transport().sendMail({
      to: order.to,
      from: process.env.SMTP_FROM,
      subject: `Your pickup order ${order.orderNumber} at ${order.storeName}`,
      html: `<body style="font-family:Helvetica,Arial,sans-serif;color:#222;max-width:560px;margin:auto">
        <h2>Thanks ${escapeHtml(order.name)}, your order is placed</h2>
        <p>Order <strong>${escapeHtml(order.orderNumber)}</strong> at ${escapeHtml(order.storeName)}. Show this number at the counter when you pick it up.</p>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ddd;border-bottom:1px solid #ddd">${rows}
          <tr><td style="padding:8px 0"><strong>Paid</strong></td><td align="right"><strong>${escapeHtml(order.total)}</strong></td></tr></table>
        <p><a href="${escapeHtml(order.link)}">View your receipt</a></p>
      </body>`,
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
