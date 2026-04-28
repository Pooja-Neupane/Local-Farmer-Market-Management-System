async function contact(req, res) {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });
  res.json({ success: true });
}

module.exports = { contact };
