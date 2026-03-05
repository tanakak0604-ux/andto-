export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { system, messages, max_tokens } = req.body;

  const prompt = (system ? `${system}\n\n` : "") +
    messages.map(m => m.content).join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${process.env.GEMINI_API_KEY}`
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: max_tokens || 8000 }
        })
      }
    );
    const data = await response.json();
    console.log("Gemini response:", JSON.stringify(data));
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
