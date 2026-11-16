import { useEffect, useRef, useState } from 'react';
import { extractJson, validate } from './validate.js';

function Flashcards({ cards }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const go = (d) => { setFlipped(false); setI((x) => (x + d + cards.length) % cards.length); };
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const c = cards[i];
  if (!c) return <p className="muted">No flashcards were generated.</p>;
  return (
    <div>
      <p className="muted">Card {i + 1} of {cards.length} · {known.size} marked known</p>
      <button className={`card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label="Flip card">
        <small>{flipped ? 'Answer' : 'Question'}</small>
        <span>{flipped ? c.back : c.front}</span>
      </button>
      <div className="row">
        <button onClick={() => go(-1)}>← Prev</button>
        <button onClick={() => setKnown((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}>
          {known.has(c.id) ? '✓ Known' : 'Mark known'}
        </button>
        <button onClick={() => go(1)}>Next →</button>
      </div>
      <p className="muted">Tip: ← → to navigate, Space to flip.</p>
    </div>
  );
}

function Quiz({ questions: all }) {
  const [qs, setQs] = useState(all);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState([]);
  const [score, setScore] = useState(0);
  const done = i >= qs.length;
  const reset = (list) => { setQs(list); setI(0); setPicked(null); setWrong([]); setScore(0); };
  if (!all.length) return <p className="muted">No quiz questions were generated.</p>;
  if (done) return (
    <div className="center">
      <h3>Score: {score} / {qs.length}</h3>
      {wrong.length > 0 && <button className="primary" onClick={() => reset(wrong)}>Re-test {wrong.length} wrong answer{wrong.length > 1 ? 's' : ''}</button>}
      <button onClick={() => reset(all)}>Restart full quiz</button>
    </div>
  );
  const q = qs[i];
  const pick = (n) => {
    if (picked !== null) return;
    setPicked(n);
    n === q.answerIndex ? setScore((s) => s + 1) : setWrong((w) => [...w, q]);
  };
  return (
    <div>
      <p className="muted">Question {i + 1} of {qs.length}</p>
      <h3>{q.question}</h3>
      {q.options.map((o, n) => {
        const state = picked === null ? '' : n === q.answerIndex ? 'right' : n === picked ? 'bad' : '';
        return <button key={n} className={`opt ${state}`} onClick={() => pick(n)} disabled={picked !== null}>{o}</button>;
      })}
      {picked !== null && (
        <>
          <p>{picked === q.answerIndex ? '✅ Correct!' : '❌ Not quite.'} {q.explanation}</p>
          <button className="primary" onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 === qs.length ? 'See score' : 'Next'}</button>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error | ready
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('cards');
  const [round, setRound] = useState(0); // remounts study views on a new result
  const latest = useRef(0);
  const ctrl = useRef(null);

  async function generate() {
    const text = input.trim();
    if (text.length < 3) { setStatus('error'); setError('Please enter some notes or a topic first.'); return; }
    const id = ++latest.current; // newest request wins
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    const timer = setTimeout(() => ctrl.current.abort(), 60000);
    setStatus('loading'); setError('');
    try {
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), signal: ctrl.current.signal });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `Request failed (${r.status}).`);
      const result = validate(extractJson(body.raw));
      if (id !== latest.current) return; // stale: ignore
      setData(result); setRound((n) => n + 1);
      setTab(result.flashcards.length ? 'cards' : 'quiz'); setStatus('ready');
    } catch (e) {
      if (id !== latest.current) return;
      setStatus('error');
      setError(e.name === 'AbortError' ? 'Request timed out. Please retry.' : e.message);
    } finally { clearTimeout(timer); }
  }

  return (
    <main>
      <h1>📚 AI Study Assistant</h1>
      <p className="muted">Paste notes or a topic. Get flashcards and a quiz.</p>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} maxLength={8000}
        placeholder="e.g. Photosynthesis, or paste your lecture notes…" aria-label="Notes or topic" />
      <div className="row">
        <button className="primary" onClick={generate} disabled={status === 'loading'}>
          {status === 'loading' ? 'Generating…' : 'Generate study set'}
        </button>
        <span className="muted">{input.length}/8000</span>
      </div>

      {status === 'loading' && <div className="box" role="status"><div className="spinner" /> Asking the model…</div>}
      {status === 'error' && (
        <div className="box err" role="alert">
          <p>⚠️ {error}</p>
          <button onClick={generate}>Retry</button>
        </div>
      )}
      {status === 'idle' && <div className="box muted">Nothing here yet — enter a topic above to begin.</div>}
      {data && status !== 'idle' && (
        <section className={status === 'loading' ? 'dim' : ''}>
          <h2>{data.title}</h2>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'cards'} className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>Flashcards ({data.flashcards.length})</button>
            <button role="tab" aria-selected={tab === 'quiz'} className={tab === 'quiz' ? 'on' : ''} onClick={() => setTab('quiz')}>Quiz ({data.quiz.length})</button>
          </div>
          {tab === 'cards' ? <Flashcards key={`c${round}`} cards={data.flashcards} /> : <Quiz key={`q${round}`} questions={data.quiz} />}
        </section>
      )}
    </main>
  );
}
