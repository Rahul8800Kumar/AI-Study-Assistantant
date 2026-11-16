// Turns untrusted model text into safe, well-shaped data or throws a friendly Error.
const str = (v) => typeof v === 'string' && v.trim().length > 0;

export function extractJson(raw) {
  if (!str(raw)) throw new Error('The model returned an empty response.');
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s >= 0 && e > s) { try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { /* fall through */ } }
  throw new Error('The model returned malformed JSON.');
}

export function validate(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Unexpected response shape.');
  const flashcards = (Array.isArray(obj.flashcards) ? obj.flashcards : [])
    .filter((c) => c && str(c.front) && str(c.back))
    .map((c, i) => ({ id: `f${i}`, front: c.front.trim(), back: c.back.trim() }));
  const quiz = (Array.isArray(obj.quiz) ? obj.quiz : [])
    .filter((q) => q && str(q.question) && Array.isArray(q.options) && q.options.length >= 2 && q.options.every(str)
      && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.options.length)
    .map((q, i) => ({ id: `q${i}`, question: q.question.trim(), options: q.options.map((o) => o.trim()),
      answerIndex: q.answerIndex, explanation: str(q.explanation) ? q.explanation.trim() : '' }));
  if (!flashcards.length && !quiz.length) throw new Error('The model returned no usable cards or questions.');
  return { title: str(obj.title) ? obj.title.trim() : 'Your study set', flashcards, quiz };
}
