export default async function handler(req, res) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  if (!NOTION_TOKEN) {
    return res.status(500).json({ error: 'NOTION_TOKEN not set in Vercel environment variables' });
  }

  const path = req.query.path || '';
  const notionUrl = 'https://api.notion.com/v1/' + path;

  let forwardMethod = 'GET';
  let forwardBody = undefined;

  if (req.body) {
    try {
      const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      forwardMethod = parsed.method || 'GET';
      forwardBody = parsed.body ? JSON.stringify(parsed.body) : undefined;
    } catch(e) {}
  }

  try {
    const response = await fetch(notionUrl, {
      method: forwardMethod,
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: forwardBody,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
