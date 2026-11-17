const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

function configured() { return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM); }
function transport() { return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: String(process.env.SMTP_SECURE) === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined }); }
async function sendNotificationEmail(user, notification) {
  if (!configured() || !user?.email) return { delivered: false, reason: 'EMAIL_NOT_CONFIGURED' };
  try { await transport().sendMail({ from: process.env.SMTP_FROM, to: user.email, subject: notification.title, text: notification.message }); logger.info('notification email delivered', { notificationId: notification.id, userId: user.id }); return { delivered: true }; } catch (error) { logger.error('notification email delivery failed', { notificationId: notification.id, error: error.message }); return { delivered: false, reason: 'DELIVERY_FAILED' }; }
}
module.exports = { configured, sendNotificationEmail };
