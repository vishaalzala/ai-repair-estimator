export function messagingAvailability() {
  return {
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    email: Boolean(process.env.RESEND_API_KEY && process.env.MESSAGING_FROM_EMAIL),
  };
}
