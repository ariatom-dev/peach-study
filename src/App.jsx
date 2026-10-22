import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icons.jsx';
import { useTheme } from './theme.js';
import { useRoute } from './route.js';
import { useCloud } from './cloud.js';
import { parseTerms } from './parse.js';
import { newId, normalizeDecks } from './data.js';
import Study from './Study.jsx';

const LOCAL_KEY = 'peach-study-deck';
const EXAMPLE = `Cell membrane: Controls what enters and leaves the cell.
Diffusion: The net movement of particles from an area of higher concentration to lower concentration.
Osmosis: The movement of water across a selectively permeable membrane.
Active transport: Movement of substances across a membrane using energy.`;

function readLocalDecks() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return normalizeDecks(saved);
  } catch {
    return [];
  }
}

export default function App() {
  const theme = useTheme();
  const [route, go] = useRoute();
  const [decks, setDecks] = useState(readLocalDecks);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  const notify = useCallback((text, tone = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(decks)); } catch { /* storage full or blocked */ }
  }, [decks]);

  const cloud = useCloud({ decks, setDecks, readLocal: readLocalDecks, notify });

  const createDeck = (title, cards) => {
    const deck = {
      id: newId(),
      title: title.trim() || 'Untitled study set',
      cards: cards.map((c) => ({ ...c, id: newId() })),
      createdAt: new Date().toISOString(),
    };
    setDecks((prev) => [deck, ...prev]);
    notify(`Created “${deck.title}” with ${cards.length} terms.`);
    go('/');
  };

  const removeDeck = (id) => {
    const deck = decks.find((d) => d.id === id);
    if (deck && !window.confirm(`Delete “${deck.title}”? This can’t be undone.`)) return;
    setDecks((prev) => prev.filter((d) => d.id !== id));
    cloud.deleteRemote(id);
    notify('Study set deleted.');
    go('/');
  };

  const updateCard = useCallback((deckId, cardId, patch) => {
    setDecks((prev) => prev.map((d) => (d.id !== deckId ? d : {
      ...d,
      cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    })));
  }, []);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(decks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'peach-study-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    notify('Backup downloaded.');
  };

  const activeDeck = route.name === 'study' ? decks.find((d) => d.id === route.id) : null;

  useEffect(() => { window.scrollTo(0, 0); }, [route.name, route.id]);

  return (
    <div className="app-shell">
      <Nav route={route} go={go} theme={theme} />
      <main className="main">
        {route.name === 'library' && <Library decks={decks} go={go} onDelete={removeDeck} syncing={cloud.busy} />}
        {route.name === 'create' && <Create onCreate={createDeck} go={go} />}
        {route.name === 'settings' && <Settings theme={theme} cloud={cloud} onExport={exportData} />}
        {route.name === 'study' && (activeDeck
          ? <Study key={activeDeck.id} deck={activeDeck} go={go} onUpdateCard={updateCard} />
          : <div className="page"><button className="back-link" onClick={() => go('/')}><Icon name="back" size={16} /> Library</button><h1>Not found</h1><p className="lede">That study set isn’t on this device.</p></div>)}
      </main>
      {toast && <div className={`toast ${toast.tone}`} role="status">{toast.text}</div>}
    </div>
  );
}

/* ───────────── Navigation ───────────── */

function Nav({ route, go, theme }) {
  const items = [
    { key: 'library', label: 'Library', icon: 'library', path: '/' },
    { key: 'create', label: 'Add', icon: 'plus', path: '/create' },
    { key: 'settings', label: 'Settings', icon: 'sliders', path: '/settings' },
  ];
  const current = route.name === 'study' ? 'library' : route.name;
  return (
    <nav className="nav" aria-label="Main">
      <div className="wordmark"><span className="wordmark-mark">p.</span><span className="wordmark-name">peach study</span></div>
      <ul className="nav-list">
        {items.map((item) => (
          <li key={item.key}>
            <button className={`nav-item ${current === item.key ? 'active' : ''}`} aria-current={current === item.key ? 'page' : undefined} onClick={() => go(item.path)}>
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="nav-theme" onClick={theme.toggle} aria-label={`Switch to ${theme.resolved === 'dark' ? 'light' : 'dark'} mode`}>
        <Icon name={theme.resolved === 'dark' ? 'sun' : 'moon'} size={19} />
        <span>{theme.resolved === 'dark' ? 'Light' : 'Dark'} mode</span>
      </button>
    </nav>
  );
}

/* ───────────── Library ───────────── */

function Library({ decks, go, onDelete, syncing }) {
  const total = decks.reduce((sum, d) => sum + d.cards.length, 0);
  return (
    <section className="page">
      <p className="eyebrow">Your collection</p>
      <h1>Library</h1>
      <p className="lede">{decks.length ? `${decks.length} ${decks.length === 1 ? 'set' : 'sets'} · ${total} terms${syncing ? ' · syncing…' : ''}` : 'Nothing here yet.'}</p>

      {decks.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Begin with a set.</p>
          <p>Paste in terms and definitions and they become cards you can study.</p>
          <button className="btn primary" onClick={() => go('/create')}>Add your first set</button>
        </div>
      ) : (
        <ul className="deck-list">
          {decks.map((deck, i) => (
            <li className="deck-row" key={deck.id}>
              <button className="deck-open" onClick={() => go(`/study/${encodeURIComponent(deck.id)}`)}>
                <span className="deck-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="deck-body">
                  <span className="deck-title">{deck.title}</span>
                  <span className="deck-meta">{deck.cards.length} terms · {deck.cards.slice(0, 3).map((c) => c.term).join(', ')}{deck.cards.length > 3 ? '…' : ''}</span>
                </span>
                <Icon name="chevron" size={18} className="deck-chevron" />
              </button>
              <button className="icon-btn" aria-label={`Delete ${deck.title}`} onClick={() => onDelete(deck.id)}><Icon name="trash" size={18} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────── Create ───────────── */

function Create({ onCreate, go }) {
  const [title, setTitle] = useState('');
  const [input, setInput] = useState('');
  const parsed = useMemo(() => parseTerms(input), [input]);
  const [error, setError] = useState('');

  const submit = () => {
    if (!parsed.length) {
      setError('No terms found yet. Use “Term: definition”, one per line.');
      return;
    }
    onCreate(title, parsed);
  };

  return (
    <section className="page narrow">
      <button className="back-link" onClick={() => go('/')}><Icon name="back" size={16} /> Library</button>
      <p className="eyebrow">New set</p>
      <h1>Add material</h1>
      <p className="lede">Paste terms and definitions, one per line.</p>

      <label className="field-label" htmlFor="set-title">Title</label>
      <input id="set-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cell Biology, Unit 3" />

      <div className="field-row">
        <label className="field-label" htmlFor="terms-input">Terms</label>
        <span className="count">{parsed.length} detected</span>
      </div>
      <textarea id="terms-input" className="input mono" value={input} onChange={(e) => { setInput(e.target.value); setError(''); }} spellCheck="false" placeholder={EXAMPLE} />
      <button className="link-btn" onClick={() => setInput(EXAMPLE)} type="button">Use an example</button>

      <div className="hint">
        <strong>Format</strong>
        <p><code>Term: Definition</code> — one per line. A vertical bar <code>|</code> or a long dash <code>—</code> works too.</p>
      </div>

      {parsed.length > 0 && (
        <div className="preview">
          <p className="eyebrow">Preview</p>
          {parsed.slice(0, 3).map((card, i) => (
            <div className="preview-row" key={`${card.term}-${i}`}><strong>{card.term}</strong><span>{card.definition}</span></div>
          ))}
          {parsed.length > 3 && <p className="count">+ {parsed.length - 3} more</p>}
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn primary wide" onClick={submit}>Create set</button>
    </section>
  );
}

/* ───────────── Settings ───────────── */

function Settings({ theme, cloud, onExport }) {
  const options = [
    { value: 'system', label: 'System', icon: 'monitor' },
    { value: 'light', label: 'Cream', icon: 'sun' },
    { value: 'dark', label: 'Charcoal', icon: 'moon' },
  ];
  return (
    <section className="page narrow">
      <p className="eyebrow">Preferences</p>
      <h1>Settings</h1>

      <div className="group">
        <h2 className="group-title">Appearance</h2>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {options.map((o) => (
            <button key={o.value} role="radio" aria-checked={theme.pref === o.value} className={theme.pref === o.value ? 'seg active' : 'seg'} onClick={() => theme.setPref(o.value)}>
              <Icon name={o.icon} size={17} /> {o.label}
            </button>
          ))}
        </div>
        <p className="note">System follows your phone’s light or dark setting.</p>
      </div>

      <div className="group">
        <h2 className="group-title">Account &amp; sync</h2>
        <Account cloud={cloud} />
      </div>

      <div className="group">
        <h2 className="group-title">Your data</h2>
        <p className="note">Everything is stored on this device. Download a backup now and then.</p>
        <button className="btn" onClick={onExport}><Icon name="download" size={17} /> Download backup</button>
      </div>
    </section>
  );
}

function Account({ cloud }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!cloud.configured) {
    return <p className="note">Cloud sync isn’t set up, so your sets live only on this device. That’s fine — to sync across devices, follow the setup steps in the README.</p>;
  }
  if (!cloud.ready) return <p className="note">Checking account…</p>;

  if (cloud.user) {
    return (
      <>
        <p className="note">Signed in as <strong>{cloud.user.email}</strong>{cloud.busy ? ' · syncing…' : ' · synced'}</p>
        <button className="btn" onClick={cloud.signOut}>Sign out</button>
      </>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const result = await cloud.submitAuth(mode, email, password);
    setBusy(false);
    if (result.error) setError(result.error);
    if (result.notice) setNotice(result.notice);
    if (result.switchTo) setMode(result.switchTo);
  };

  return (
    <form onSubmit={submit} className="auth-form">
      <p className="note">Optional. Sign in to keep your sets in sync between devices.</p>
      <label className="field-label" htmlFor="auth-email">Email</label>
      <input id="auth-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="field-label" htmlFor="auth-password">Password</label>
      <input id="auth-password" className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-ok" role="status">{notice}</p>}
      <button className="btn primary wide" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
      <button className="link-btn center" type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setNotice(''); }}>
        {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create an account'}
      </button>
    </form>
  );
}
