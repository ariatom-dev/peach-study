import { useCallback, useMemo, useState } from 'react';
import Icon from './icons.jsx';
import Feed from './Feed.jsx';
import Cards from './Cards.jsx';
import { readJSON, writeJSON } from './store.js';

const MODE_KEY = 'peach-study-mode';
const RECALL_KEY = 'peach-study-recall';

const MODES = [
  { key: 'scroll', label: 'Scroll' },
  { key: 'cards', label: 'Cards' },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'starred', label: 'Saved' },
  { key: 'learn', label: 'To learn' },
];

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shared frame for every way of studying a set: header, mode switch, filters and the card order. */
export default function Study({ deck, go, onUpdateCard }) {
  const [mode, setModeState] = useState(() => {
    const saved = readJSON(MODE_KEY, 'scroll');
    return MODES.some((m) => m.key === saved) ? saved : 'scroll';
  });
  const [filter, setFilter] = useState('all');
  const [isShuffled, setIsShuffled] = useState(false);
  const [recall, setRecall] = useState(() => readJSON(RECALL_KEY, false));
  const [version, setVersion] = useState(0);

  const build = useCallback((f, shuffle) => {
    const base = deck.cards.filter((c) => (f === 'starred' ? c.starred : f === 'learn' ? !c.known : true)).map((c) => c.id);
    return shuffle ? shuffled(base) : base;
  }, [deck.cards]);
  // The order is a snapshot so marking a card "known" doesn't make it vanish mid-scroll.
  const [order, setOrder] = useState(() => build('all', false));

  const byId = useMemo(() => new Map(deck.cards.map((c) => [c.id, c])), [deck.cards]);
  const items = useMemo(() => order.map((id) => byId.get(id)).filter(Boolean), [order, byId]);

  const apply = useCallback((nextFilter, nextShuffle) => {
    setFilter(nextFilter);
    setIsShuffled(nextShuffle);
    setOrder(build(nextFilter, nextShuffle));
    setVersion((v) => v + 1);
  }, [build]);

  const view = useMemo(() => ({ filter, shuffled: isShuffled, apply, version }), [filter, isShuffled, apply, version]);

  const setMode = (next) => { setModeState(next); writeJSON(MODE_KEY, next); };
  const toggleRecall = () => setRecall((r) => { writeJSON(RECALL_KEY, !r); return !r; });

  const known = deck.cards.filter((c) => c.known).length;
  const saved = deck.cards.filter((c) => c.starred).length;
  const percent = deck.cards.length ? Math.round((known / deck.cards.length) * 100) : 0;

  return (
    <section className="study" aria-label={`Studying ${deck.title}`}>
      <header className="study-head">
        <div className="study-top">
          <button className="icon-btn plain" onClick={() => go('/')} aria-label="Back to library"><Icon name="back" size={20} /></button>
          <div className="study-title">
            <span className="study-name">{deck.title}</span>
            <span className="study-stats">{known} of {deck.cards.length} known{saved ? ` · ${saved} saved` : ''}</span>
          </div>
          <div className="mode-switch" role="tablist" aria-label="Study mode">
            {MODES.map((m) => (
              <button key={m.key} role="tab" aria-selected={mode === m.key} className={mode === m.key ? 'on' : ''} onClick={() => setMode(m.key)}>{m.label}</button>
            ))}
          </div>
        </div>
        <div className="study-progress" role="progressbar" aria-label="Known" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div>
        <div className="chips" role="toolbar" aria-label="Study options">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`} aria-pressed={filter === f.key} onClick={() => apply(f.key, isShuffled)}>{f.label}</button>
          ))}
          <span className="chip-sep" aria-hidden="true" />
          <button className={`chip ${isShuffled ? 'on' : ''}`} aria-pressed={isShuffled} onClick={() => apply(filter, !isShuffled)}><Icon name="shuffle" size={15} /> Shuffle</button>
          {mode === 'scroll' && <button className={`chip ${recall ? 'on' : ''}`} aria-pressed={recall} onClick={toggleRecall}>Hide definitions</button>}
        </div>
      </header>

      <div className="study-body">
        {mode === 'scroll' && <Feed key="scroll" deck={deck} items={items} view={view} recall={recall} go={go} onUpdateCard={onUpdateCard} />}
        {mode === 'cards' && <Cards key="cards" deck={deck} items={items} view={view} go={go} onUpdateCard={onUpdateCard} />}
      </div>
    </section>
  );
}
