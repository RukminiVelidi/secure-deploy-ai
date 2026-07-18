const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'SecureDeploy AI <noreply@algearithm.xyz>';

/**
 * Sends the high-risk / blocked-deployment alert.
 * `toEmail` is resolved by the caller via user.resolveNotificationEmail(),
 * which respects the user's profile-vs-GitHub email preference.
 */
async function sendHighRiskEmail(toEmail, repoName, score, reportId, pdfBuffer) {
  if (!toEmail) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `🚨 High Risk Deployment Blocked — ${repoName}`,
      html: `
        <h2>⚠️ SecureDeploy AI Alert</h2>
        <p>A deployment to <strong>${repoName}</strong> has been <strong>BLOCKED</strong>.</p>
        <p><strong>Risk Score:</strong> ${score}/100+</p>
        <p><a href="${process.env.CLIENT_URL}/reports/${reportId}">View Full Report</a></p>
        <hr/>
        <p style="color:#888;font-size:12px">SecureDeploy AI — AI-powered deployment safety</p>
      `,
      attachments: pdfBuffer ? [{ filename: 'securedeployai-report.pdf', content: pdfBuffer }] : undefined
    });
  } catch (err) {
    console.error('Email failed:', err.message);
  }
}

/**
 * Sends a lighter-weight summary for every scan (not just blocked ones),
 * if/when you want to notify on every run rather than only high risk.
 */
async function sendScanSummaryEmail(toEmail, repoName, report) {
  if (!toEmail) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `Scan complete — ${repoName} (${report.riskLevel} risk)`,
      html: `
        <h2>🛡️ SecureDeploy AI Scan Complete</h2>
        <p><strong>${repoName}</strong> — ${report.findings.length} finding(s), risk score ${report.riskScore}.</p>
        <p>${report.gptSummary || ''}</p>
        <p><a href="${process.env.CLIENT_URL}/reports/${report._id}">View Full Report</a></p>
      `
    });
  } catch (err) {
    console.error('Email failed:', err.message);
  }
}

async function sendReportEmail(toEmail, repoName, report, pdfBuffer) {
  if (!toEmail) throw new Error('No destination email address on this account');
  const emoji = { Low: '✅', Medium: '⚠️', High: '❌' }[report.riskLevel] || '';
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `SecureDeploy AI Report — ${repoName} (${report.riskLevel} risk)`,
    html: `
      <h2>🛡️ SecureDeploy AI Scan Report</h2>
      <p><strong>${repoName}</strong> — ${emoji} ${report.riskLevel} risk, score ${report.riskScore}, ${report.findings.length} finding(s).</p>
      <p>Full formatted report attached as PDF.</p>
      <p><a href="${process.env.CLIENT_URL}/reports/${report._id}">View in dashboard</a></p>
    `,
    attachments: [{ filename: 'securedeployai-report.pdf', content: pdfBuffer }]
  });
}

module.exports = { sendHighRiskEmail, sendScanSummaryEmail, sendReportEmail };
