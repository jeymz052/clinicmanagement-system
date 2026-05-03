import { HttpError } from "@/src/lib/http";

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

type ContactEmailParams = {
  name: string;
  email: string;
  message: string;
};

function getEmailJsConfig() {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
  const templateId = process.env.EMAILJS_TEMPLATE_ID?.trim();
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();

  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      "EmailJS is not configured. Add EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, and EMAILJS_PUBLIC_KEY.",
    );
  }

  return { serviceId, templateId, publicKey, privateKey };
}

export async function sendContactEmail(params: ContactEmailParams) {
  const { serviceId, templateId, publicKey, privateKey } = getEmailJsConfig();
  const submittedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.NEXT_PUBLIC_CLINIC_TIME_ZONE ?? process.env.CLINIC_TIME_ZONE ?? "Asia/Manila",
  });

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      ...(privateKey ? { accessToken: privateKey } : {}),
      template_params: {
        from_name: params.name,
        from_email: params.email,
        message: params.message,
        submitted_at: submittedAt,
        reply_to: params.email,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new HttpError(502, `EmailJS send failed: ${response.status}${message ? ` ${message}` : ""}`);
  }
}
