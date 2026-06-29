const FROM = 'Golf Sniper <alerts@kotobaapp.com>';
const WORKER_URL = 'https://golf-sniper.evanwkennedy.workers.dev';

function baseTemplate(body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:32px auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#2e7d32;padding:20px;text-align:center">
      <div style="font-size:1.6rem">⛳</div>
      <div style="color:white;font-size:1.1rem;font-weight:700;margin-top:6px">Golf Tee Time Sniper</div>
    </div>
    <div style="padding:28px 24px">
      ${body}
    </div>
    <div style="padding:16px 24px;background:#f9f9f9;text-align:center;font-size:0.75rem;color:#aaa">
      You're receiving this because you set up a tee time alert.
    </div>
  </div>
</body>
</html>`;
}

export async function sendConfirmationEmail(apiKey, { to, token, courseName, date, earliestTime, latestTime, minPlayers, holes }) {
  const confirmUrl = `${WORKER_URL}/confirm-email?token=${token}`;
  const displayDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:1.15rem;color:#222">Confirm your tee time alert</h2>
    <p style="margin:0 0 20px;color:#555;font-size:0.9rem;line-height:1.5">
      You requested an alert for <strong>${courseName}</strong> on <strong>${displayDate}</strong>
      (${earliestTime}–${latestTime} · ${minPlayers}+ players · ${holes} holes).
      Click below to confirm.
    </p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${confirmUrl}"
         style="display:inline-block;background:#4caf50;color:white;text-decoration:none;padding:14px 32px;border-radius:9px;font-weight:700;font-size:1rem">
        Confirm Alert
      </a>
    </div>
    <p style="margin:0;color:#aaa;font-size:0.78rem;text-align:center">
      This link expires in 24 hours. If you didn't request this, ignore this email.
    </p>
  `);

  return resendSend(apiKey, { to, subject: `Confirm your alert — ${courseName} on ${displayDate}`, html });
}

export async function sendAlertEmail(apiKey, { to, courseName, date, slots, bookingUrl }) {
  const displayDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  const slotRows = slots.map(slot => {
    const priceStr = slot.greenFee ? ` &mdash; $${slot.greenFee}/pp` : '';
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:600;color:#222">${slot.time}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#555">${slot.availableSpots} spot(s)${priceStr}</td>
    </tr>`;
  }).join('');

  const html = baseTemplate(`
    <h2 style="margin:0 0 4px;font-size:1.15rem;color:#2e7d32">⛳ Tee time available!</h2>
    <p style="margin:0 0 20px;color:#555;font-size:0.9rem">${courseName} &mdash; ${displayDate}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${slotRows}
    </table>
    <div style="text-align:center;margin-bottom:8px">
      <a href="${bookingUrl}"
         style="display:inline-block;background:#4caf50;color:white;text-decoration:none;padding:14px 32px;border-radius:9px;font-weight:700;font-size:1rem">
        Book Now →
      </a>
    </div>
    <p style="margin:12px 0 0;color:#aaa;font-size:0.78rem;text-align:center">
      Book quickly — these slots go fast.
    </p>
  `);

  return resendSend(apiKey, { to, subject: `⛳ Tee time open — ${courseName} on ${displayDate}`, html });
}

async function resendSend(apiKey, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}
