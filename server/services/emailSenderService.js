/**
 * Checks whether SMTP credentials are fully configured
 */
export function isEmailConfigured() {
  return Boolean(process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASS?.trim());
}

/**
 * Generic newsroom email sender
 */
export async function sendNewsroomEmail({ to, subject, html, text, attachments = [] }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email Dispatcher (Dev Fallback)]: To: ${to} | Subject: ${subject}`);
    return { success: true, delivered: false, mode: 'dev_preview' };
  }
  try {
    const mailOptions = {
      from: `"PublicSpark Newsroom" <${process.env.GMAIL_USER.trim()}>`,
      to,
      subject,
      text,
      html
    };
    if (Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }
    const info = await t.sendMail(mailOptions);
    return { success: true, delivered: true, messageId: info.messageId, mode: 'live_smtp' };
  } catch (err) {
    console.error(`[Email Dispatcher Error]: Failed to deliver to ${to}:`, err.message);
    return { success: false, delivered: false, error: err.message };
  }
}


import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { buildOtpEmailHtml } from './emailTemplateService.js';

let transporter = null;

function getTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASS?.replace(/\s+/g, '').trim();

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass
      },
      connectionTimeout: 15000, // 15s connection timeout
      socketTimeout: 30000     // 30s socket timeout
    });
  }

  return transporter;
}

/**
 * Verify SMTP connection with Google Mail servers
 */
export async function verifySmtpConnection() {
  const t = getTransporter();
  if (!t) {
    return {
      connected: false,
      reason: 'No GMAIL_USER or GMAIL_APP_PASS configured in environment.'
    };
  }

  try {
    await t.verify();
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Dispatches an official PublicSpark OTP email
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.recipientName
 * @param {string} options.otpCode
 * @param {string} options.purpose - 'email_verification' | 'password_reset'
 * @param {string} [options.siteUrl]
 */
export async function dispatchOtpEmail({
  toEmail,
  recipientName = 'Journalist',
  otpCode,
  purpose = 'email_verification',
  siteUrl = 'http://localhost:5173'
}) {
  const cleanEmail = String(toEmail || '').toLowerCase().trim();
  const isEmailVerification = purpose === 'email_verification';
  const subject = isEmailVerification
    ? `[PublicSpark] Your Newsroom Verification Code: ${otpCode}`
    : `[PublicSpark] Password Reset Passcode: ${otpCode}`;

  const htmlContent = buildOtpEmailHtml({
    recipientName,
    otpCode,
    purpose,
    siteUrl
  });

  const textContent = `Dear ${recipientName},\n\nYour PublicSpark one-time security passcode is: ${otpCode}\n\nThis code is strictly valid for 5 minutes. Do not share it with anyone.\n\nPublicSpark Editorial Desk`;

  const t = getTransporter();

  // If no SMTP configured, log in console for development fallback
  if (!t) {
    console.log(`[Email Dispatcher (Dev Fallback)]: To: ${cleanEmail} | OTP: [ ${otpCode} ] (No SMTP credentials configured)`);
    return {
      success: true,
      delivered: false,
      mode: 'dev_preview',
      otpCode
    };
  }

  const logoPath = path.resolve('public/logo.png');
  const attachments = [];

  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: 'publicspark-logo.png',
      path: logoPath,
      cid: 'publicspark_official_logo'
    });
  }

  try {
    const info = await t.sendMail({
      from: `"PublicSpark Newsroom" <${process.env.GMAIL_USER.trim()}>`,
      to: cleanEmail,
      subject,
      text: textContent,
      html: htmlContent,
      attachments
    });

    console.log(`[Email Dispatcher]: Real email delivered to ${cleanEmail} (Message ID: ${info.messageId})`);

    return {
      success: true,
      delivered: true,
      messageId: info.messageId,
      mode: 'live_smtp'
    };
  } catch (err) {
    console.error(`[Email Dispatcher Error]: Failed to deliver to ${cleanEmail}:`, err.message);
    // Return gracefully so the API response doesn't break
    return {
      success: true, // OTP was generated
      delivered: false,
      error: err.message,
      mode: 'live_failed_fallback',
      otpCode
    };
  }
}

