# AI Study Assistant

Paste notes or a topic → the model returns **structured JSON** → the app renders interactive **flashcards** (flip, navigate, mark known) and a **quiz** with scoring and **re-test of wrong answers**. Not a chatbot.

## Setup
```bash
npm install
cp .env.example .env     # add a free GEMINI_API_KEY from aistudio.google.com
npm start                # API on :3001, app on http://localhost:5173
```
Requires Node 20.6+ (uses `node --env-file`).

## Architecture
- `server.js`: small Express proxy. The API key never reaches the browser. Asks Gemini for JSON (`responseMimeType: application/json`), 45s timeout, returns raw text.
- `src/validate.js`: strips code fences, extracts JSON, validates shape, drops bad items (e.g. `answerIndex` out of range), throws friendly errors if nothing usable remains.
- `src/App.jsx`: state machine (`idle | loading | error | ready`), `Flashcards`, `Quiz` components.

## Handling bad AI output
| Failure | Behaviour |
|---|---|
| Malformed JSON / fenced JSON | Cleaned, then first `{…}` extracted; else error + Retry |
| Wrong shape / bad items | Invalid items dropped; if nothing left → error + Retry |
| Empty response | Error + Retry |
| Slow / failed / unreachable | Server 45s timeout, client 60s abort, error + Retry |
| Stale response | Request id + `AbortController`; only the newest request may update state |

## AI-usage note
(Edit honestly.) I used Claude to scaffold the project and first draft of components; I reviewed, ran and can explain every file. 

## Known limitations
No streaming, no saved sessions, no refinement prompts, no automated tests, input capped at 8000 chars.

## Time spent
~__ hours. Next: streaming, localStorage sessions, follow-up edits, tests.
