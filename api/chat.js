module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { system, messages, max_tokens } = req.body;
  const prompt = (system ? system + "\n\n" : "") + messages.map(function(m) { return m.content; }).join("\n");
  const apiKey = process.env.GEMINI_API_KEY;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + apiKey;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: max_tokens || 8000 }
      })
    });

    const rawText = await response.text();
    console.log("Gemini raw:", rawText.slice(0, 300));

    let data;
    try { data = JSON.parse(rawText); }
    catch(e) { return res.status(500).json({ error: { message: "Parse error: " + rawText.slice(0, 200) } }); }

    if (data.error) return res.status(500).json({ error: { message: data.error.message } });

    const text = data.candidates[0].content.parts[0].text || "";
    res.status(200).json({ content: [{ type: "text", text: text }] });
  } catch(e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
