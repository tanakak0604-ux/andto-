export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { model, messages, system, max_tokens } = req.body;

    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: max_tokens || 8000,
        temperature: 0.7,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: { message: data.error.message } });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}
