// services/emailService.js
// Handles all email notifications for Detective Query using Brevo HTTP REST API.
// Uses HTTPS (port 443) — 100% reliable on cloud hosts like Render with zero SMTP blocks.

require('dotenv').config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER = {
  name: 'Detective Query',
  email: process.env.MAIL_USER || 'jonathandelacruz0004@gmail.com'
};

/**
 * Generic helper to send email via Brevo REST API
 */
async function sendViaBrevo({ to, subject, htmlContent }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: to }],
      subject,
      htmlContent
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Brevo Error]:', data);
    throw new Error(data.message || 'Failed to send email via Brevo');
  }

  return data;
}

// ───────────────────────────────────────────────────────────────
// Send approval email to a newly approved user
// ───────────────────────────────────────────────────────────────
async function sendApprovalEmail({ to, fullName, role }) {
  const roleName = role === 2 ? 'Teacher' : 'Student';
  const loginUrl = 'https://detective-query.vercel.app/login';

  await sendViaBrevo({
    to,
    subject: '✅ Access Approved — Welcome to Detective Query!',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a1226; margin: 0; padding: 0; }
          .wrapper { max-width: 560px; margin: 40px auto; background: #0d1a38; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,240,255,0.25); }
          .header { background: linear-gradient(135deg, #0a1226 0%, #0d1a38 100%); padding: 36px 32px 24px; text-align: center; border-bottom: 1px solid rgba(0,240,255,0.2); }
          .badge { display: inline-block; background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; font-size: 11px; font-weight: 700; letter-spacing: 2px; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
          .logo { font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin: 0; }
          .logo span { color: #00f0ff; }
          .body { padding: 32px; }
          .status-badge { display: inline-block; background: rgba(0,255,102,0.12); border: 1px solid #00ff66; color: #00ff66; font-size: 13px; font-weight: 700; letter-spacing: 1px; padding: 6px 16px; border-radius: 20px; margin-bottom: 20px; }
          h2 { color: #ffffff; font-size: 20px; margin: 0 0 12px; }
          p { color: #94a3b8; line-height: 1.7; margin: 0 0 16px; font-size: 14px; }
          .highlight { color: #ffffff; font-weight: 600; }
          .info-box { background: rgba(0,240,255,0.06); border: 1px solid rgba(0,240,255,0.2); border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
          .info-label { color: #64748b; }
          .info-value { color: #e2e8f0; font-weight: 600; }
          .cta-btn { display: block; width: fit-content; margin: 24px auto 0; background: linear-gradient(135deg, #00ff66, #00d4aa); color: #020617 !important; font-weight: 800; font-size: 14px; letter-spacing: 1px; padding: 14px 32px; border-radius: 10px; text-decoration: none; text-align: center; }
          .footer { padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.07); text-align: center; }
          .footer p { color: #475569; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <div class="badge">DETECTIVE QUERY</div>
            <p class="logo">DETECTIVE <span>QUERY</span></p>
          </div>
          <div class="body">
            <div class="status-badge">✅ ACCESS APPROVED</div>
            <h2>Welcome aboard, ${fullName}!</h2>
            <p>Your registration request for <span class="highlight">Detective Query</span> has been reviewed and <span class="highlight" style="color:#00ff66;">approved</span> by the administrator.</p>
            <div class="info-box">
              <div class="info-row"><span class="info-label">Name</span><span class="info-value">${fullName}</span></div>
              <div class="info-row"><span class="info-label">Email</span><span class="info-value">${to}</span></div>
              <div class="info-row" style="margin-bottom:0;"><span class="info-label">Role</span><span class="info-value">${roleName}</span></div>
            </div>
            <p>You can now log in using the email and password you registered with. Welcome to the investigation! 🔍</p>
            <a class="cta-btn" href="${loginUrl}" target="_blank" rel="noopener noreferrer">🔒 LOGIN TO DETECTIVE QUERY</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Detective Query. Do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
  console.log(`[EmailService] Approval email sent to ${to}`);
}

// ───────────────────────────────────────────────────────────────
// Send rejection email
// ───────────────────────────────────────────────────────────────
async function sendRejectionEmail({ to, fullName, reason }) {
  await sendViaBrevo({
    to,
    subject: '❌ Access Request Update — Detective Query',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a1226; margin: 0; padding: 0; }
          .wrapper { max-width: 560px; margin: 40px auto; background: #0d1a38; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,240,255,0.25); }
          .header { background: linear-gradient(135deg, #0a1226 0%, #0d1a38 100%); padding: 36px 32px 24px; text-align: center; border-bottom: 1px solid rgba(0,240,255,0.2); }
          .badge { display: inline-block; background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; font-size: 11px; font-weight: 700; letter-spacing: 2px; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
          .logo { font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin: 0; }
          .logo span { color: #00f0ff; }
          .body { padding: 32px; }
          .status-badge { display: inline-block; background: rgba(239,68,68,0.12); border: 1px solid #ef4444; color: #ef4444; font-size: 13px; font-weight: 700; letter-spacing: 1px; padding: 6px 16px; border-radius: 20px; margin-bottom: 20px; }
          h2 { color: #ffffff; font-size: 20px; margin: 0 0 12px; }
          p { color: #94a3b8; line-height: 1.7; margin: 0 0 16px; font-size: 14px; }
          .highlight { color: #ffffff; font-weight: 600; }
          .reason-box { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
          .reason-label { color: #ef4444; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
          .reason-text { color: #e2e8f0; font-size: 14px; }
          .footer { padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.07); text-align: center; }
          .footer p { color: #475569; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <div class="badge">DETECTIVE QUERY</div>
            <p class="logo">DETECTIVE <span>QUERY</span></p>
          </div>
          <div class="body">
            <div class="status-badge">❌ REQUEST NOT APPROVED</div>
            <h2>Hello, ${fullName}</h2>
            <p>Thank you for your interest in <span class="highlight">Detective Query</span>. Unfortunately, your access request has been reviewed and was <span class="highlight" style="color:#ef4444;">not approved</span> at this time.</p>
            ${reason ? `<div class="reason-box"><div class="reason-label">REASON PROVIDED</div><div class="reason-text">${reason}</div></div>` : ''}
            <p>If you believe this is a mistake, please contact your instructor or school administrator for assistance.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Detective Query. Do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
  console.log(`[EmailService] Rejection email sent to ${to}`);
}

// ───────────────────────────────────────────────────────────────
// Send email verification code (OTP) during registration
// ───────────────────────────────────────────────────────────────
async function sendVerificationCode({ to, code }) {
  await sendViaBrevo({
    to,
    subject: '🔐 Email Verification Code — Detective Query',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a1226; margin: 0; padding: 0; }
          .wrapper { max-width: 560px; margin: 40px auto; background: #0d1a38; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,240,255,0.25); }
          .header { background: linear-gradient(135deg, #0a1226 0%, #0d1a38 100%); padding: 36px 32px 24px; text-align: center; border-bottom: 1px solid rgba(0,240,255,0.2); }
          .badge { display: inline-block; background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; font-size: 11px; font-weight: 700; letter-spacing: 2px; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
          .logo { font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin: 0; }
          .logo span { color: #00f0ff; }
          .body { padding: 32px; text-align: center; }
          h2 { color: #ffffff; font-size: 20px; margin: 0 0 12px; }
          p { color: #94a3b8; line-height: 1.7; margin: 0 0 16px; font-size: 14px; }
          .code-box { background: rgba(0,240,255,0.08); border: 2px solid rgba(0,240,255,0.4); border-radius: 14px; padding: 24px; margin: 24px auto; display: inline-block; }
          .code { font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #00f0ff; font-family: 'JetBrains Mono', 'Courier New', monospace; }
          .expire { color: #64748b; font-size: 12px; margin-top: 8px; }
          .footer { padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.07); text-align: center; }
          .footer p { color: #475569; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <div class="badge">DETECTIVE QUERY</div>
            <p class="logo">DETECTIVE <span>QUERY</span></p>
          </div>
          <div class="body">
            <h2>📧 Verify Your Email</h2>
            <p>Enter the verification code below to confirm your email address.</p>
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            <p class="expire">This code expires in <strong style="color:#e2e8f0;">10 minutes</strong></p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Detective Query. Do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
  console.log(`[EmailService] Verification code sent to ${to}`);
}

// ───────────────────────────────────────────────────────────────
// Send account change approved email (Section / Password)
// ───────────────────────────────────────────────────────────────
async function sendAccountChangeApprovedEmail({ to, fullName, requestType, newValue }) {
  const isSection = requestType === 'change_section';
  const typeTitle = isSection ? 'Section Change Approved' : 'Password Reset Approved';
  const loginUrl = 'https://detective-query.vercel.app/login';

  await sendViaBrevo({
    to,
    subject: `✅ ${typeTitle} — Detective Query`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a1226; margin: 0; padding: 0; }
          .wrapper { max-width: 560px; margin: 40px auto; background: #0d1a38; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,240,255,0.25); }
          .header { background: linear-gradient(135deg, #0a1226 0%, #0d1a38 100%); padding: 36px 32px 24px; text-align: center; border-bottom: 1px solid rgba(0,240,255,0.2); }
          .badge { display: inline-block; background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; font-size: 11px; font-weight: 700; letter-spacing: 2px; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
          .logo { font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin: 0; }
          .logo span { color: #00f0ff; }
          .body { padding: 32px; }
          .status-badge { display: inline-block; background: rgba(0,255,102,0.12); border: 1px solid #00ff66; color: #00ff66; font-size: 13px; font-weight: 700; letter-spacing: 1px; padding: 6px 16px; border-radius: 20px; margin-bottom: 20px; }
          h2 { color: #ffffff; font-size: 20px; margin: 0 0 12px; }
          p { color: #94a3b8; line-height: 1.7; margin: 0 0 16px; font-size: 14px; }
          .highlight { color: #ffffff; font-weight: 600; }
          .info-box { background: rgba(0,240,255,0.06); border: 1px solid rgba(0,240,255,0.2); border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
          .info-label { color: #64748b; }
          .info-value { color: #e2e8f0; font-weight: 600; }
          .cta-btn { display: block; width: fit-content; margin: 24px auto 0; background: linear-gradient(135deg, #00ff66, #00d4aa); color: #020617 !important; font-weight: 800; font-size: 14px; letter-spacing: 1px; padding: 14px 32px; border-radius: 10px; text-decoration: none; text-align: center; }
          .footer { padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.07); text-align: center; }
          .footer p { color: #475569; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <div class="badge">DETECTIVE QUERY</div>
            <p class="logo">DETECTIVE <span>QUERY</span></p>
          </div>
          <div class="body">
            <div class="status-badge">✅ ${typeTitle.toUpperCase()}</div>
            <h2>Hello, ${fullName}!</h2>
            <p>Your request to update your account details has been <span class="highlight" style="color:#00ff66;">approved</span> by the administrator.</p>
            <div class="info-box">
              <div class="info-row"><span class="info-label">Account</span><span class="info-value">${to}</span></div>
              ${isSection ? `<div class="info-row" style="margin-bottom:0;"><span class="info-label">New Section</span><span class="info-value" style="color:#00f0ff;">${newValue}</span></div>` : `<div class="info-row" style="margin-bottom:0;"><span class="info-label">Password Status</span><span class="info-value" style="color:#00ff66;">Updated Successfully</span></div>`}
            </div>
            <p>${isSection ? 'Your section has been updated. You can now access your classroom rooms and tasks under your new section.' : 'Your new password is now active. Please use your new password next time you log in.'}</p>
            <a class="cta-btn" href="${loginUrl}" target="_blank" rel="noopener noreferrer">🔒 GO TO DETECTIVE QUERY</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Detective Query. Do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
  console.log(`[EmailService] Account change approval email sent to ${to}`);
}

// ───────────────────────────────────────────────────────────────
// Send account change rejected email (Section / Password)
// ───────────────────────────────────────────────────────────────
async function sendAccountChangeRejectedEmail({ to, fullName, requestType, reason }) {
  const isSection = requestType === 'change_section';
  const typeTitle = isSection ? 'Section Change Request' : 'Password Reset Request';

  await sendViaBrevo({
    to,
    subject: `❌ ${typeTitle} Update — Detective Query`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a1226; margin: 0; padding: 0; }
          .wrapper { max-width: 560px; margin: 40px auto; background: #0d1a38; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,240,255,0.25); }
          .header { background: linear-gradient(135deg, #0a1226 0%, #0d1a38 100%); padding: 36px 32px 24px; text-align: center; border-bottom: 1px solid rgba(0,240,255,0.2); }
          .badge { display: inline-block; background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; font-size: 11px; font-weight: 700; letter-spacing: 2px; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px; }
          .logo { font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin: 0; }
          .logo span { color: #00f0ff; }
          .body { padding: 32px; }
          .status-badge { display: inline-block; background: rgba(239,68,68,0.12); border: 1px solid #ef4444; color: #ef4444; font-size: 13px; font-weight: 700; letter-spacing: 1px; padding: 6px 16px; border-radius: 20px; margin-bottom: 20px; }
          h2 { color: #ffffff; font-size: 20px; margin: 0 0 12px; }
          p { color: #94a3b8; line-height: 1.7; margin: 0 0 16px; font-size: 14px; }
          .highlight { color: #ffffff; font-weight: 600; }
          .reason-box { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
          .reason-label { color: #ef4444; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
          .reason-text { color: #e2e8f0; font-size: 14px; }
          .footer { padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.07); text-align: center; }
          .footer p { color: #475569; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <div class="badge">DETECTIVE QUERY</div>
            <p class="logo">DETECTIVE <span>QUERY</span></p>
          </div>
          <div class="body">
            <div class="status-badge">❌ REQUEST NOT APPROVED</div>
            <h2>Hello, ${fullName}</h2>
            <p>Your request to update your account (${isSection ? 'Change Section' : 'Reset Password'}) was <span class="highlight" style="color:#ef4444;">not approved</span> at this time.</p>
            ${reason ? `<div class="reason-box"><div class="reason-label">REASON PROVIDED</div><div class="reason-text">${reason}</div></div>` : ''}
            <p>If you have questions, please contact your instructor or system administrator.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Detective Query. Do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
  console.log(`[EmailService] Account change rejection email sent to ${to}`);
}

module.exports = {
  sendApprovalEmail,
  sendRejectionEmail,
  sendVerificationCode,
  sendAccountChangeApprovedEmail,
  sendAccountChangeRejectedEmail
};

