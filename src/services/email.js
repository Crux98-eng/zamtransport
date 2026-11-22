const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const logger = require('../utils/logger');

const brandColor = '#f15a24';
const baseUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
const sender = () => process.env.EMAIL_FROM || process.env.SMTP_FROM;
let resendClient;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);
}

function configured() {
  return Boolean(sender() && (process.env.RESEND_API_KEY || smtpConfigured()));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function frame({ preheader, heading, intro, buttonLabel, buttonUrl, details, outro }) {
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeDetails = details ? escapeHtml(details) : '';
  const safeOutro = outro ? escapeHtml(outro) : '';
  const safeUrl = escapeHtml(buttonUrl);
  const safeButton = escapeHtml(buttonLabel);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#202124">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden">
        <tr><td style="background:#17181b;padding:24px 32px;border-bottom:5px solid ${brandColor}">
          <div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#fff">ZAMBIA TRANSPORT</div>
          <div style="font-size:11px;letter-spacing:1px;color:#c8c8cf;margin-top:6px">YOUR JOURNEY, CONNECTED</div>
        </td></tr>
        <tr><td style="padding:36px 32px 18px">
          <h1 style="margin:0 0 16px;font-size:25px;line-height:1.25;color:#17181b">${safeHeading}</h1>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#555761">${safeIntro}</p>
          ${details ? `<div style="margin-top:20px;padding:14px 16px;border-radius:10px;background:#f7f7f8;color:#555761;font-size:14px;line-height:1.65">${safeDetails}</div>` : ''}
          ${buttonUrl ? `<div style="padding:26px 0 12px"><a href="${safeUrl}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 22px;border-radius:9px">${safeButton}</a></div>` : ''}
          ${safeOutro ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#777984">${safeOutro}</p>` : ''}
        </td></tr>
        <tr><td style="padding:18px 32px 26px;border-top:1px solid #ececef;font-size:12px;line-height:1.6;color:#858791">
          Zambia Transport System<br>This is an automated message. If you did not request this, you can safely ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function verificationEmail(user, role, verificationUrl) {
  const audience = role === 'DRIVER' ? 'driver application' : 'commuter account';
  return {
    subject: 'Verify your Zambia Transport email',
    html: frame({
      preheader: 'Confirm your email to continue with Zambia Transport.',
      heading: `Hello ${user.fullName},`,
      intro: `Please verify your email address to continue with your ${audience}.`,
      buttonLabel: 'Verify email address',
      buttonUrl: verificationUrl,
      details: 'This secure link expires in 30 minutes and can only be used once.',
      outro: 'If the button does not work, copy and paste the link from this email into your browser.',
    }),
    text: `Hello ${user.fullName},\n\nVerify your email address to continue with your ${audience}:\n${verificationUrl}\n\nThis link expires in 30 minutes and can only be used once.`,
  };
}

function driverApprovedEmail(user, loginUrl) {
  return {
    subject: 'Your Zambia Transport driver account is approved',
    html: frame({
      preheader: 'Your driver application has been approved.',
      heading: `Welcome, ${user.fullName}!`,
      intro: 'Your driver application has been approved. You can now sign in and access your driver account.',
      buttonLabel: 'Sign in to your account',
      buttonUrl: loginUrl,
      details: 'Thank you for joining the Zambia Transport driver team.',
    }),
    text: `Welcome, ${user.fullName}!\n\nYour driver application has been approved. Sign in here: ${loginUrl}`,
  };
}

function driverRejectedEmail(user, reason) {
  const details = reason ? `Application decision: ${reason}` : 'Your driver application was not approved at this time.';
  return {
    subject: 'Update on your Zambia Transport driver application',
    html: frame({
      preheader: 'There is an update to your driver application.',
      heading: `Hello ${user.fullName},`,
      intro: 'Thank you for applying to join Zambia Transport as a driver. After review, we are unable to approve your application at this time.',
      details,
      outro: 'If you believe this decision was made in error, please contact the transport team.',
    }),
    text: `Hello ${user.fullName},\n\nYour driver application was not approved.${reason ? `\nReason: ${reason}` : ''}\n\nIf you believe this decision was made in error, please contact the transport team.`,
  };
}

function smtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
}

async function sendEmail({ to, subject, html, text, purpose, userId }) {
  const provider = process.env.RESEND_API_KEY ? 'resend' : smtpConfigured() ? 'smtp' : 'none';
  logger.info('email delivery attempt', { purpose, userId, provider });
  if (!configured() || !to) {
    logger.warn('email delivery unavailable', { purpose, userId, reason: !to ? 'RECIPIENT_MISSING' : 'EMAIL_NOT_CONFIGURED' });
    return { accepted: false, reason: 'EMAIL_NOT_CONFIGURED' };
  }

  try {
    if (provider === 'resend') {
      resendClient ||= new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resendClient.emails.send({ from: sender(), to, subject, html, text });
      if (error) throw new Error(error.message || 'Resend rejected the email.');
      if (!data?.id) throw new Error('Resend did not confirm acceptance of the email.');
      logger.info('email accepted by provider', { purpose, userId, provider, messageId: data.id });
      return { accepted: true };
    }

    const result = await smtpTransport().sendMail({ from: sender(), to, subject, html, text });
    if (!Array.isArray(result.accepted) || result.accepted.length === 0) throw new Error('SMTP server did not accept the recipient.');
    logger.info('email accepted by provider', { purpose, userId, provider });
    return { accepted: true };
  } catch (error) {
    logger.error('email delivery failed', { purpose, userId, provider, error: error.message });
    return { accepted: false, reason: 'DELIVERY_FAILED' };
  }
}

async function sendVerificationEmail(user, role, token) {
  const verificationUrl = new URL('/verify-email', baseUrl());
  verificationUrl.searchParams.set('token', token);
  const template = verificationEmail(user, role, verificationUrl.toString());
  return sendEmail({ ...template, to: user.email, purpose: `${role.toLowerCase()}_verification`, userId: user.id });
}

async function sendDriverApprovalEmail(user) {
  const template = driverApprovedEmail(user, new URL('/login', baseUrl()).toString());
  return sendEmail({ ...template, to: user.email, purpose: 'driver_approval', userId: user.id });
}

async function sendDriverRejectionEmail(user, reason) {
  const template = driverRejectedEmail(user, reason);
  return sendEmail({ ...template, to: user.email, purpose: 'driver_rejection', userId: user.id });
}

async function sendNotificationEmail(user, notification) {
  return sendEmail({
    to: user?.email,
    subject: notification.title,
    text: notification.message,
    purpose: 'notification',
    userId: user?.id,
  });
}

module.exports = {
  configured,
  driverApprovedEmail,
  driverRejectedEmail,
  escapeHtml,
  frame,
  sendDriverApprovalEmail,
  sendDriverRejectionEmail,
  sendEmail,
  sendNotificationEmail,
  sendVerificationEmail,
  verificationEmail,
};
