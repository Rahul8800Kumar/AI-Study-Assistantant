// Tiny proxy: keeps the API key on the server. Returns the model's raw text;
// the client parses + validates it (see src/validate.js).
import express from "express";
const app = express();
app.use(express.json({ limit: "50kb" }));
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SYSTEM = `You create study material from the user's notes or topic.
Return ONLY JSON: {"title":string,"flashcards":[{"front":string,"back":string}],"quiz":[{"question":string,"options":[4 strings],"answerIndex":0-3,"explanation":string}]}
Make 8 flashcards and 6 quiz questions.`;

app.post("/api/generate", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (text.length < 3)
    return res
      .status(400)
      .json({ error: "Please enter some notes or a topic." });
  if (!KEY)
    return res
      .status(500)
      .json({ error: "Server is missing GEMINI_API_KEY (see README)." });
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ parts: [{ text: text.slice(0, 8000) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        }),
        signal: AbortSignal.timeout(45000),
      },
    );
    if (!r.ok) {
      const detail = await r.text();
      console.error("Gemini error", r.status, detail);
      return res
        .status(502)
        .json({
          error: `Model API error (${r.status}). Check the server terminal.`,
        });
    }
    const j = await r.json();
    res.json({ raw: j.candidates?.[0]?.content?.parts?.[0]?.text ?? "" });
  } catch (e) {
    res
      .status(504)
      .json({
        error:
          e.name === "TimeoutError"
            ? "The model took too long."
            : "Could not reach the model.",
      });
  }
});
app.listen(3001, () => console.log("API on http://localhost:3001"));
