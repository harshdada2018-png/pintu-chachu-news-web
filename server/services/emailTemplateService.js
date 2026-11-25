/**
 * PublicSpark Official Email Templates
 * Standard broadsheet newsroom typography with official logo header.
 */

export function buildOtpEmailHtml({ recipientName = 'Journalist', otpCode, purpose = 'email_verification', siteUrl = 'https://publicspark.in' }) {
  const isEmailVerification = purpose === 'email_verification';
  const headingTitle = isEmailVerification 
    ? 'Journalist Application - Email Verification' 
    : 'Editorial Desk Password Reset';
  const badgeLabel = isEmailVerification 
    ? 'NEWSROOM APPLICANT VERIFICATION' 
    : 'EDITORIAL CREDENTIAL SECURITY';
  const messageBody = isEmailVerification
    ? 'Thank you for applying to join the PublicSpark Newsroom. To confirm that this email address belongs to you, please enter the one-time security passcode below. Once verified, your application will be forwarded to the Super Admin Desk for official approval.'
    : 'We received a request to verify your identity and reset the security password for your PublicSpark Newsroom account.';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>PublicSpark Newsroom Passcode</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; display: block; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Broadsheet Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);">
          
          <!-- Master Editorial Masthead (Deep Obsidian Navy) -->
          <tr>
            <td style="padding: 28px 24px 24px 24px; background-color: #0f172a; text-align: center; border-bottom: 3px solid #b91c1c;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Embedded High-Res Logo (CID) -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 10px auto;">
                      <tr>
                        <td align="center" style="background-color: #ffffff; padding: 6px 14px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);">
                          <img src="cid:publicspark_official_logo" alt="PUBLIC SPARK" height="38" style="height: 38px; max-width: 200px; display: block; object-fit: contain;" />
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Clean Letterpress Wordmark -->
                    <h1 style="margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 800; letter-spacing: 0.12em; color: #ffffff; text-transform: uppercase;">
                      PUBLIC <span style="color: #ef4444;">SPARK</span>
                    </h1>
                    
                    <p style="margin: 0; font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: #94a3b8; font-weight: 700;">
                      Sovereign Multilingual Digital Newsroom
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Badge Banner -->
          <tr>
            <td style="background-color: #f8fafc; padding: 10px 24px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #b91c1c;">
                ● ${badgeLabel}
              </span>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding: 32px 28px 28px 28px; background-color: #ffffff;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.35; letter-spacing: -0.01em;">
                ${headingTitle}
              </h2>
              
              <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Dear <strong>${recipientName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.65; color: #475569;">
                ${messageBody}
              </p>

              <!-- High-Contrast Monospace Passcode Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #fef2f2; border: 2px dashed #b91c1c; border-radius: 6px; padding: 20px 24px; max-width: 320px; box-sizing: border-box;">
                      <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #991b1b; display: block; margin-bottom: 8px;">
                        One-Time Security Passcode (OTP)
                      </span>
                      <span style="font-family: 'JetBrains Mono', 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 0.28em; color: #b91c1c; display: block; padding-left: 0.28em;">
                        ${otpCode}
                      </span>
                      <span style="font-size: 11px; font-weight: 700; color: #7f1d1d; display: block; margin-top: 8px;">
                        Strictly Valid for 5 Minutes • Single-Use Only
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Guidelines Notice -->
              <div style="background-color: #f8fafc; border-left: 4px solid #b91c1c; padding: 14px 16px; margin: 24px 0 20px 0; border-radius: 0 4px 4px 0;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.06em;">
                  Editorial Security Standards
                </p>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.6;">
                  <li>This passcode will automatically expire in <strong>5 minutes</strong>.</li>
                  <li>Do not share or forward this security code to anyone.</li>
                  <li>PublicSpark Editors will never contact you asking for your password.</li>
                </ul>
              </div>

              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">
                If you did not initiate this registration request, please disregard this email. No account will be created without this passcode confirmation.
              </p>
            </td>
          </tr>

          <!-- Formal Broadsheet Newsroom Footer -->
          <tr>
            <td style="padding: 20px 24px; background-color: #0f172a; border-top: 1px solid #1e293b; font-size: 11px; color: #94a3b8; line-height: 1.6; text-align: center;">
              <p style="margin: 0 0 4px 0; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; text-transform: uppercase;">
                PUBLIC SPARK EDITORIAL & CYBERSECURITY DESK
              </p>
              <p style="margin: 0 0 6px 0; color: #94a3b8;">
                Built with precision for sovereign human journalism.
              </p>
              <p style="margin: 0;">
                <a href="${siteUrl}/staff" style="color: #f87171; text-decoration: underline; font-weight: 700;">Newsroom Staff Gateway</a> • <a href="${siteUrl}" style="color: #94a3b8; text-decoration: none;">publicspark.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

