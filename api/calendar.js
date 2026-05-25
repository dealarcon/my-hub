async function getValidToken(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  let accessToken = cookies.gcal_access;
  const refreshToken = cookies.gcal_refresh;
  const expiry = parseInt(cookies.gcal_expiry || '0');

  // Refresh if expired or expiring in next 60s
  if ((!accessToken || Date.now() > expiry - 60000) && refreshToken) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await r.json();
    if (data.access_token) {
      accessToken = data.access_token;
      const cookieOpts = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000';
      res.setHeader('Set-Cookie', [
        `gcal_access=${accessToken}; ${cookieOpts}`,
        `gcal_expiry=${Date.now() + (data.expires_in || 3600) * 1000}; ${cookieOpts}`,
      ]);
    }
  }
  return accessToken;
}

function parseCookies(str) {
  return Object.fromEntries(
    str.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
      .filter(([k]) => k)
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const { action } = req.query;

  try {
    // GET /api/calendar?action=list_calendars
    if (action === 'list_calendars') {
      const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // GET /api/calendar?action=events&calendarId=...&timeMin=...&timeMax=...
    if (action === 'events') {
      const { calendarId = 'primary', timeMin, timeMax } = req.query;
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });
      if (timeMin) params.set('timeMin', timeMin);
      if (timeMax) params.set('timeMax', timeMax);
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // POST /api/calendar?action=create
    if (action === 'create' && req.method === 'POST') {
      const { calendarId = 'primary', event } = req.body || {};
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      );
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // DELETE /api/calendar?action=delete&calendarId=...&eventId=...
    if (action === 'delete' && req.method === 'DELETE') {
      const { calendarId = 'primary', eventId } = req.query;
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
      );
      return res.status(r.status).json({ ok: r.ok });
    }

    // GET /api/calendar?action=status — check if connected
    if (action === 'status') {
      const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
        headers: { Authorization: 'Bearer ' + token }
      });
      return res.status(200).json({ connected: r.ok });
    }

    // POST /api/calendar?action=disconnect
    if (action === 'disconnect') {
      const cookieOpts = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
      res.setHeader('Set-Cookie', [
        `gcal_access=; ${cookieOpts}`,
        `gcal_refresh=; ${cookieOpts}`,
        `gcal_expiry=; ${cookieOpts}`,
      ]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
