import { useEffect, useMemo, useState } from 'react';

const EXAMPLE = `Cell membrane: Controls what enters and leaves the cell.
Diffusion: The net movement of particles from an area of higher concentration to lower concentration.
Osmosis: The movement of water across a selectively permeable membrane.
Active transport: Movement of substances across a membrane using energy.`;

function parseTerms(text) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Accepted formats: "Term: definition", "Term — definition", or "Term | definition"
      const match = line.match(/^(.+?)\s*(?::|—|\|)\s*(.+)$/);
      if (!match) return null;
      return { term: match[1].trim(), definition: match[2].trim() };
    })
    .filter((item) => item && item.term && item.definition);
}

export default function App() {
  const [input, setInput] = useState(EXAMPLE);
  const [title, setTitle] = useState('Cell Biology');
  const [deck, setDeck] = useState(() => {
    try { return JSON.parse(localStorage.getItem('peach-study-deck') || '[]'); }
    catch { return []; }
  });
  const [activeView, setActiveView] = useState('library');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    localStorage.setItem('peach-study-deck', JSON.stringify(deck));
  }, [deck]);

  const parsed = useMemo(() => parseTerms(input), [input]);

  function createStudySet() {
    if (!parsed.length) {
      setMessage('I couldn’t find any terms. Use “Term: definition”, one per line.');
      return;
    }
    const set = {
      id: Date.now(),
      title: title.trim() || 'Untitled study set',
      cards: parsed,
      createdAt: new Date().toISOString()
    };
    setDeck((previous) => [set, ...previous]);
    setActiveIndex(0);
    setShowDefinition(false);
    setActiveView('library');
    setMessage(`Created “${set.title}” with ${parsed.length} terms.`);
  }

  function openSet(set) {
    setActiveView(`study:${set.id}`);
    setActiveIndex(0);
    setShowDefinition(false);
    setMessage('');
  }

  const activeSetId = activeView.startsWith('study:') ? Number(activeView.split(':')[1]) : null;
  const activeSet = deck.find((set) => set.id === activeSetId);
  const activeCard = activeSet?.cards[activeIndex];

  function moveCard(direction) {
    if (!activeSet) return;
    setActiveIndex((index) => Math.min(activeSet.cards.length - 1, Math.max(0, index + direction)));
    setShowDefinition(false);
  }

  function removeSet(id) {
    setDeck((previous) => previous.filter((set) => set.id !== id));
    setActiveView('library');
    setMessage('Study set deleted.');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'peach-study-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Backup downloaded.');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">p.</div>
        <div className="brand-name">peach study</div>
        <p className="brand-caption">your little learning space</p>
        <nav>
          <button className={activeView === 'library' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('library'); setMessage(''); }}>
            <span>▦</span> My library
          </button>
          <button className={activeView === 'create' ? 'nav-item active' : 'nav-item'} onClick={() => { setActiveView('create'); setMessage(''); }}>
            <span>＋</span> Create from text
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="tiny-leaf">✳</div>
          <p>Your notes, your pace.</p>
          <button className="backup-button" onClick={exportData}>Export backup ↗</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span className="eyebrow">YOUR PERSONAL STUDY SPACE</span>
          <span className="local-pill"><span className="status-dot" /> Saved on this device</span>
        </header>

        {activeView === 'library' && (
          <section className="page">
            <div className="page-intro">
              <div>
                <p className="eyebrow sage">A LITTLE PROGRESS ADDS UP</p>
                <h1>Your study library<span className="period">.</span></h1>
                <p className="subtitle">Small cards. Clear definitions. One thing at a time.</p>
              </div>
              <div className="sun-doodle">✳</div>
            </div>
            <div className="summary-strip">
              <div><span className="summary-number">{deck.length.toString().padStart(2, '0')}</span><span className="summary-label">study sets</span></div>
              <div><span className="summary-number">{deck.reduce((sum, set) => sum + set.cards.length, 0).toString().padStart(2, '0')}</span><span className="summary-label">terms saved</span></div>
              <button className="primary-button" onClick={() => { setActiveView('create'); setMessage(''); }}>＋ Create a study set</button>
            </div>
            {message && <div className="message" role="status">{message}</div>}
            {deck.length === 0 ? (
              <div className="empty-state">
                <div className="empty-illustration"><span>✳</span><span>✧</span><div>✎</div></div>
                <h2>Your first study set starts here</h2>
                <p>Paste in a list of terms and definitions. We’ll turn each line into a study card.</p>
                <button className="primary-button" onClick={() => setActiveView('create')}>Make my first set</button>
              </div>
            ) : (
              <div className="set-grid">
                {deck.map((set, index) => (
                  <article className={`set-card card-tone-${index % 3}`} key={set.id}>
                    <div className="set-card-top"><span className="set-icon">{['✳', '▤', '✿'][index % 3]}</span><span className="count-pill">{set.cards.length} terms</span></div>
                    <h2>{set.title}</h2>
                    <p>{set.cards.slice(0, 3).map((card) => card.term).join(' · ')}{set.cards.length > 3 ? ' · …' : ''}</p>
                    <div className="set-card-footer">
                      <button className="text-button" onClick={() => openSet(set)}>Start studying <span>↗</span></button>
                      <button className="delete-button" aria-label={`Delete ${set.title}`} onClick={() => removeSet(set.id)}>×</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeView === 'create' && (
          <section className="page create-page">
            <button className="back-link" onClick={() => { setActiveView('library'); setMessage(''); }}>← Back to library</button>
            <p className="eyebrow sage">TURN YOUR NOTES INTO CARDS</p>
            <h1>Create a study set<span className="period">.</span></h1>
            <p className="subtitle">Paste your terms and definitions below. No AI, no complicated setup.</p>
            <label className="field-label" htmlFor="set-title">Study set name</label>
            <input id="set-title" className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Cell Biology" />
            <div className="editor-heading"><label className="field-label" htmlFor="terms-input">Your terms + definitions</label><span>{parsed.length} detected</span></div>
            <textarea id="terms-input" value={input} onChange={(event) => setInput(event.target.value)} spellCheck="false" />
            <div className="format-help">
              <strong>Simple format</strong>
              <p>Put one term per line, followed by a colon and its definition.</p>
              <code>Diffusion: Movement from high to low concentration</code>
              <p>You can also separate them with a vertical bar <code>|</code> or a long dash <code>—</code>.</p>
            </div>
            {parsed.length > 0 && (
              <div className="preview">
                <div className="preview-head"><span className="eyebrow">PREVIEW</span><span>{parsed.length} cards</span></div>
                {parsed.slice(0, 3).map((card, index) => <div className="preview-row" key={`${card.term}-${index}`}><strong>{card.term}</strong><span>{card.definition}</span></div>)}
                {parsed.length > 3 && <p className="more-preview">+ {parsed.length - 3} more cards</p>}
              </div>
            )}
            <button className="primary-button create-submit" onClick={createStudySet}>Create study set <span>↗</span></button>
            {message && <div className="message" role="status">{message}</div>}
          </section>
        )}

        {activeSet && activeCard && (
          <section className="page study-page">
            <button className="back-link" onClick={() => { setActiveView('library'); setMessage(''); }}>← My library</button>
            <div className="study-heading"><div><p className="eyebrow sage">STUDY MODE</p><h1>{activeSet.title}<span className="period">.</span></h1></div><span className="count-pill">{activeIndex + 1} / {activeSet.cards.length}</span></div>
            <div className="progress-track"><div style={{ width: `${((activeIndex + 1) / activeSet.cards.length) * 100}%` }} /></div>
            <button className={`study-card ${showDefinition ? 'revealed' : ''}`} onClick={() => setShowDefinition((shown) => !shown)}>
              <span className="card-kicker">{showDefinition ? 'DEFINITION' : 'TERM'}</span>
              <span className="card-main">{showDefinition ? activeCard.definition : activeCard.term}</span>
              <span className="card-hint">{showDefinition ? 'Tap to see the term' : 'Tap to reveal definition'}</span>
              <span className="card-star">✳</span>
            </button>
            <div className="study-controls">
              <button className="secondary-button" disabled={activeIndex === 0} onClick={() => moveCard(-1)}>← Previous</button>
              <button className="primary-button" disabled={activeIndex === activeSet.cards.length - 1} onClick={() => moveCard(1)}>Next term →</button>
            </div>
            <p className="study-footnote">Take your time. You can revisit any term whenever you like.</p>
          </section>
        )}
      </main>
    </div>
  );
}