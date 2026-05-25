export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?gcal_error=' + encodeURIComponent(error));
  }
  if (!code) {
    return res.redirect('/?gcal_error=no_code');
  }

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      return res.redirect('/?gcal_error=' + encodeURIComponent(tokens.error));
    }

    // Store tokens in cookies (httpOnly, secure)
    const cookieOpts = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000';
    res.setHeader('Set-Cookie', [
      `gcal_access=${tokens.access_token}; ${cookieOpts}`,
      `gcal_refresh=${tokens.refresh_token || ''}; ${cookieOpts}`,
      `gcal_expiry=${Date.now() + (tokens.expires_in || 3600) * 1000}; ${cookieOpts}`,
    ]);

    res.redirect('/?gcal_connected=1');
  } catch (e) {
    res.redirect('/?gcal_error=' + encodeURIComponent(e.message));
  }
}
