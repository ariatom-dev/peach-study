import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase.js';

const EXAMPLE = `Cell membrane: Controls what enters and leaves the cell.
Diffusion: The net movement of particles from an area of higher concentration to lower concentration.
Osmosis: The movement of water across a selectively permeable membrane.
Active transport: Movement of substances across a membrane using energy.`;
const LOCAL_KEY = 'peach-study-deck';

function parseTerms(text) {
  return text.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(.+?)\s*(?::|—|\|)\s*(.+)$/);
    if (!match) return null;
    return { term: match[1].trim(), definition: match[2].trim() };
  }).filter((item) => item && item.term && item.definition);
}

function readLocalDecks() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(saved) ? saved.map((set) => ({ ...set, id: String(set.id) })) : [];
  } catch {
    return [];
  }
}

function friendlyError(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  if (/Invalid login credentials/i.test(message)) return 'That email and password combination was not recognized.';
  if (/User already registered/i.test(message)) return 'An account with this email already exists. Try signing in instead.';
  if (/Email not confirmed/i.test(message)) return 'Please confirm your email using the link Supabase sent you, then sign in.';
  return message;
}

export default function App() {
  const [input, setInput] = useState(EXAMPLE);
  const [title, setTitle] = useState('Cell Biology');
  const [deck, setDeck] = useState(readLocalDecks);
  const [activeView, setActiveView] = useState('library');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [authMode, setAuthMode] = useState('signup');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [authError, setAuthError] = useState('');
  const [decksLoaded, setDecksLoaded] = useState(false);
  const migrationStarted = useRef(false);

  const parsed = useMemo(() => parseTerms(input), [input]);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(deck));
  }, [deck]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthError(friendlyError(error));
      setSession(data?.session || null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      setDecksLoaded(false);
      migrationStarted.current = false;
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setDecksLoaded(!supabaseConfigured || !session);
      return;
    }
    let alive = true;
    async function loadCloudDecks() {
      setCloudBusy(true);
      setMessage('');
      const { data, error } = await supabase
        .from('study_decks')
        .select('id,title,cards,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (!alive) return;
      if (error) {
        setMessage(`Cloud sync couldn't load your decks: ${friendlyError(error)} Check that you ran the SQL setup file.`);
        setCloudBusy(false);
        setDecksLoaded(true);
        return;
      }

      const localDecks = readLocalDecks();
      const cloudDecks = (data || []).map((row) => ({
        id: String(row.id),
        title: row.title,
        cards: Array.isArray(row.cards) ? row.cards : [],
        createdAt: row.created_at || new Date().toISOString(),
      }));
      const cloudIds = new Set(cloudDecks.map((set) => String(set.id)));
      const localOnly = localDecks.filter((set) => !cloudIds.has(String(set.id)));

      // Merge local-only decks into the signed-in user's cloud library once.
      if (localOnly.length && !migrationStarted.current) {
        migrationStarted.current = true;
        const payload = localOnly.map((set) => ({
          user_id: session.user.id,
          id: String(set.id),
          title: set.title || 'Untitled study set',
          cards: Array.isArray(set.cards) ? set.cards : [],
          created_at: set.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        const { error: migrateError } = await supabase.from('study_decks').upsert(payload, { onConflict: 'user_id,id' });
        if (!alive) return;
        if (migrateError) {
          setMessage(`Your cloud decks loaded, but local decks could not be copied up: ${friendlyError(migrateError)}`);
        } else {
          cloudDecks.push(...localOnly);
          cloudDecks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setMessage(`Synced ${localOnly.length} existing deck${localOnly.length === 1 ? '' : 's'} from this device to your account.`);
        }
      }
      setDeck(cloudDecks);
      setDecksLoaded(true);
      setCloudBusy(false);
    }
    loadCloudDecks();
    return () => { alive = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase || !session?.user?.id || !decksLoaded) return;
    let alive = true;
    async function syncDecks() {
      const payload = deck.map((set) => ({
        user_id: session.user.id,
        id: String(set.id),
        title: set.title || 'Untitled study set',
        cards: Array.isArray(set.cards) ? set.cards : [],
        created_at: set.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      // The app writes individual decks on create and delete; this effect keeps edits/backups in sync.
      if (!payload.length) return;
      const { error } = await supabase.from('study_decks').upsert(payload, { onConflict: 'user_id,id' });
      if (alive && error) setMessage(`Cloud save failed: ${friendlyError(error)}`);
    }
    syncDecks();
    return () => { alive = false; };
  }, [deck, session?.user?.id, decksLoaded]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          setAuthNotice('Your account is ready. Your decks will now sync to this account.');
        } else {
          setAuthNotice('Account created! Check your email for a confirmation link, then come back and sign in.');
          setAuthMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        setAuthNotice('Signed in. Loading your synced decks…');
      }
    } catch (error) {
      setAuthError(friendlyError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(friendlyError(error));
    else {
      setDeck(readLocalDecks());
      setDecksLoaded(false);
      setMessage('Signed out. The decks already saved on this device remain here.');
    }
  }

  async function createStudySet() {
    if (!parsed.length) {
      setMessage('I couldn’t find any terms. Use “Term: definition”, one per line.');
      return;
    }
    const newSet = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: title.trim() || 'Untitled study set',
      cards: parsed,
      createdAt: new Date().toISOString(),
    };
    setDeck((previous) => [newSet, ...previous]);
    setActiveIndex(0);
    setShowDefinition(false);
    setActiveView('library');
    setMessage(`Created “${newSet.title}” with ${parsed.length} terms.`);
    if (supabase && session?.user?.id) {
      const { error } = await supabase.from('study_decks').upsert({
        user_id: session.user.id,
        id: String(newSet.id),
        title: newSet.title,
        cards: newSet.cards,
        created_at: newSet.createdAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,id' });
      if (error) setMessage(`Saved on this device, but cloud save failed: ${friendlyError(error)}`);
    }
  }

  function openSet(set) {
    setActiveView(`study:${set.id}`);
    setActiveIndex(0);
    setShowDefinition(false);
    setMessage('');
  }

  const activeSetId = activeView.startsWith('study:') ? activeView.slice('study:'.length) : null;
  const activeSet = deck.find((set) => String(set.id) === activeSetId);
  const activeCard = activeSet?.cards[activeIndex];

  function moveCard(direction) {
    if (!activeSet) return;
    setActiveIndex((index) => Math.min(activeSet.cards.length - 1, Math.max(0, index + direction)));
    setShowDefinition(false);
  }

  async function removeSet(id) {
    setDeck((previous) => previous.filter((set) => String(set.id) !== String(id)));
    setActiveView('library');
    setMessage('Study set deleted.');
    if (supabase && session?.user?.id) {
      const { error } = await supabase.from('study_decks').delete().eq('user_id', session.user.id).eq('id', String(id));
      if (error) setMessage(`Removed on this device, but cloud delete failed: ${friendlyError(error)}`);
    }
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

  if (!authReady) {
    return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">p.</div><h1>Opening your study space…</h1></div></div>;
  }

  if (!supabaseConfigured) {
    return (
      <div className="auth-screen">
        <div className="auth-card setup-card">
          <div className="brand-mark">p.</div>
          <p className="eyebrow sage">ONE-TIME SETUP</p>
          <h1>Let’s connect your cloud.</h1>
          <p>Cloud sync is not configured yet. Add your separate Peach Study Supabase project URL and publishable key to a <code>.env.local</code> file, then restart the app and redeploy.</p>
          <p className="setup-note">Your existing app is still safe. This screen means the cloud connection settings haven't been added yet.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <div className="brand-mark">p.</div>
          <p className="eyebrow sage">YOUR LITTLE LEARNING SPACE</p>
          <h1>{authMode === 'signup' ? 'Create your account.' : 'Welcome back.'}</h1>
          <p className="auth-subtitle">Sign in to keep your study decks synced between devices.</p>
          <label className="field-label" htmlFor="auth-email">Email address</label>
          <input id="auth-email" className="title-input" type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
          <label className="field-label" htmlFor="auth-password">Password</label>
          <input id="auth-password" className="title-input" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
          {authError && <div className="message error-message" role="alert">{authError}</div>}
          {authNotice && <div className="message" role="status">{authNotice}</div>}
          <button className="primary-button create-submit" disabled={authBusy} type="submit">{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
          <button className="text-button auth-switch" type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); setAuthNotice(''); }}>
            {authMode === 'signup' ? 'Already have an account? Sign in' : 'New to Peach Study? Create an account'}
          </button>
        </form>
      </div>
    );
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
          <div className="account-actions">
            <span className="local-pill"><span className="status-dot" /> {cloudBusy ? 'Syncing…' : 'Cloud sync on'}</span>
            <span className="account-email">{session.user.email}</span>
            <button className="backup-button" onClick={signOut}>Sign out</button>
          </div>
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
            {cloudBusy && <div className="message" role="status">Checking your cloud library…</div>}
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
