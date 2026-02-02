/**
 * Email Signature Template for MAIA
 * 
 * Generates HTML email signatures with:
 * - Agent branding: "This email is from {AgentName}, {UserName}'s Executive Assistant"
 * - MAIA branding with logo
 * - CTA: "Want your own AI Assistant? Get MAIA"
 */

export interface SignatureParams {
  agentName: string;
  userName: string;
  userTitle?: string;
  userCompany?: string;
  userEmail?: string;
  agentEmail: string;
}

/**
 * Generate HTML email signature
 */
export function generateEmailSignature(params: SignatureParams): string {
  const {
    agentName,
    userName,
    userTitle,
    userCompany,
    userEmail,
    agentEmail,
  } = params;

  // Build user info line
  const userInfoParts: string[] = [];
  if (userTitle) userInfoParts.push(userTitle);
  if (userCompany) userInfoParts.push(userCompany);
  const userInfo = userInfoParts.length > 0 ? userInfoParts.join(" at ") : "";

  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #374151;">
  <tr>
    <td style="padding-bottom: 16px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right: 16px; vertical-align: top;">
            <img src="https://madewell-maia.vercel.app/logos/profile-icon.png" alt="${agentName}" width="48" height="48" style="border-radius: 50%; display: block;" />
          </td>
          <td style="vertical-align: top;">
            <div style="font-weight: 600; color: #111827; font-size: 15px;">${agentName}</div>
            <div style="color: #6B7280; font-size: 13px;">${userName}'s Executive Assistant</div>
            ${userInfo ? `<div style="color: #9CA3AF; font-size: 12px; margin-top: 2px;">${userInfo}</div>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="border-top: 1px solid #E5E7EB; padding-top: 12px;">
      <div style="color: #9CA3AF; font-size: 12px; margin-bottom: 8px;">
        This email was sent by ${agentName}, an AI assistant powered by MAIA.
        ${userEmail ? `Reply to reach ${userName} at <a href="mailto:${userEmail}" style="color: #2563EB; text-decoration: none;">${userEmail}</a>` : ""}
      </div>
      <div style="margin-top: 12px;">
        <a href="https://madewell-maia.vercel.app/hire" style="display: inline-block; background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
          Want your own AI Assistant? Get MAIA
        </a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 12px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <a href="https://madewell-maia.vercel.app" style="text-decoration: none;">
              <img src="https://madewell-maia.vercel.app/logos/blue-navy-logo.png" alt="MAIA" height="20" style="display: block;" />
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Generate a simpler text-based signature for plain text emails
 */
export function generateTextSignature(params: SignatureParams): string {
  const { agentName, userName, userTitle, userCompany, userEmail } = params;

  const lines: string[] = [
    "---",
    `${agentName}`,
    `${userName}'s Executive Assistant`,
  ];

  if (userTitle && userCompany) {
    lines.push(`${userTitle} at ${userCompany}`);
  } else if (userTitle || userCompany) {
    lines.push(userTitle || userCompany || "");
  }

  lines.push("");
  lines.push(`This email was sent by ${agentName}, an AI assistant powered by MAIA.`);
  
  if (userEmail) {
    lines.push(`Reply to reach ${userName} at ${userEmail}`);
  }

  lines.push("");
  lines.push("Want your own AI Assistant? Get MAIA: https://madewell-maia.vercel.app/hire");

  return lines.join("\n");
}

/**
 * Append signature to HTML email body
 */
export function appendSignatureToHtml(htmlBody: string, signature: string): string {
  // Add some spacing before the signature
  return `${htmlBody}<br><br><br>${signature}`;
}

/**
 * Append signature to plain text email body
 */
export function appendSignatureToText(textBody: string, signature: string): string {
  return `${textBody}\n\n\n${signature}`;
}
