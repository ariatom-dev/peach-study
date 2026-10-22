import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './icons.jsx';
import { readJSON, writeJSON } from './store.js';

const posKey = (deckId) => `peach-study-pos-${deckId}`;

/**
 * Vertical, snap-scrolling feed: one term + definition per screen, scroll for the next.
 * `items` is the ordered list of cards to show; `view` carries the filter/shuffle state.
 */
export default function Feed({ deck, items, view, recall, go, onUpdateCard }) {
  const [revealed, setRevealed] = useState(() => new Set());
  const [current, setCurrent] = useState(0);
  const scroller = useRef(null);
  const total = items.length;
  const known = deck.cards.filter((c) => c.known).length;
  const saved = deck.cards.filter((c) => c.starred).length;

  const scrollToIndex = useCallback((i, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(total, i)); // index `total` is the end slide
    el.scrollTo({ top: clamped * el.clientHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, [total]);

  // Restore the last position for this deck once.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !total) return;
    restored.current = true;
    const last = readJSON(posKey(deck.id), 0);
    if (last > 0 && last < total) requestAnimationFrame(() => scrollToIndex(last, false));
  }, [total, deck.id, scrollToIndex]);

  // Track which slide is on screen.
  const orderKey = items.map((c) => c.id).join('|');
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setCurrent(Number(entry.target.dataset.index));
      });
    }, { root: el, threshold: 0.6 });
    el.querySelectorAll('.slide').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [orderKey]);

  useEffect(() => {
    if (restored.current && current < total) writeJSON(posKey(deck.id), current);
  }, [current, total, deck.id]);

  // New order (filter / shuffle) → back to the top, and forget what was revealed.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setRevealed(new Set());
    scroller.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [view.version]);
  useEffect(() => { setRevealed(new Set()); }, [recall]);

  const reveal = (id) => setRevealed((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  // Keyboard: ↑/↓ or J/K move, Space reveals (recall mode), S saves, M marks known.
  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea|select/i.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const card = items[current];
      switch (e.key) {
        case 'ArrowDown': case 'j': e.preventDefault(); scrollToIndex(current + 1); break;
        case 'ArrowUp': case 'k': e.preventDefault(); scrollToIndex(current - 1); break;
        case ' ': case 'Enter': if (card && recall) { e.preventDefault(); reveal(card.id); } break;
        case 's': if (card) onUpdateCard(deck.id, card.id, { starred: !card.starred }); break;
        case 'm': if (card) onUpdateCard(deck.id, card.id, { known: !card.known }); break;
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="feed-scroll" ref={scroller} tabIndex={0}>
      {items.map((card, i) => {
        const hidden = recall && !revealed.has(card.id);
        return (
          <article className="slide" data-index={i} key={card.id}>
            <div className="slide-inner" onClick={() => recall && reveal(card.id)}>
              <p className="slide-eyebrow">
                <span>{String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
                {card.group && <span className="slide-group">{card.group}</span>}
              </p>
              <h2 className="slide-term">{card.term}</h2>
              <span className="slide-rule" aria-hidden="true" />
              {hidden ? (
                <button className="reveal" onClick={(e) => { e.stopPropagation(); reveal(card.id); }}>Tap to reveal definition</button>
              ) : (
                <div className="slide-answer">
                  <p className="slide-def">{card.definition}</p>
                  {card.example && <p className="slide-example">{card.example}</p>}
                </div>
              )}
            </div>
            <div className="slide-actions">
              <button className={`act ${card.starred ? 'on' : ''}`} aria-pressed={!!card.starred} onClick={() => onUpdateCard(deck.id, card.id, { starred: !card.starred })}>
                <Icon name="bookmark" size={20} /><span>{card.starred ? 'Saved' : 'Save'}</span>
              </button>
              <button className={`act ${card.known ? 'on' : ''}`} aria-pressed={!!card.known} onClick={() => onUpdateCard(deck.id, card.id, { known: !card.known })}>
                <Icon name="check" size={20} /><span>{card.known ? 'Known' : 'I know this'}</span>
              </button>
            </div>
            {i === 0 && total > 1 && <p className="scroll-cue" aria-hidden="true">Scroll for next</p>}
          </article>
        );
      })}

      <article className="slide end" data-index={total}>
        <div className="slide-inner">
          <p className="slide-eyebrow"><span>End of set</span></p>
          <EndCopy total={total} known={known} saved={saved} deck={deck} filter={view.filter} />
          <div className="end-actions">
            {total > 0 && <button className="btn primary" onClick={() => scrollToIndex(0)}>Back to start</button>}
            {view.filter !== 'learn' && known < deck.cards.length && <button className="btn" onClick={() => view.apply('learn', true)}>Review what’s left</button>}
            {view.filter !== 'all' && <button className="btn" onClick={() => view.apply('all', false)}>Show all</button>}
            <button className="btn" onClick={() => go('/')}>Library</button>
          </div>
        </div>
      </article>
    </div>
  );
}

export function EndCopy({ total, known, saved, deck, filter }) {
  if (total === 0) {
    return (
      <>
        <h2 className="slide-term small">Nothing to show.</h2>
        <span className="slide-rule" aria-hidden="true" />
        <p className="slide-def">{filter === 'starred' ? 'You haven’t saved any terms yet.' : filter === 'learn' ? 'Every term is marked known. Nicely done.' : 'This set is empty.'}</p>
      </>
    );
  }
  return (
    <>
      <h2 className="slide-term small">{known === deck.cards.length ? 'All known.' : 'That’s the set.'}</h2>
      <span className="slide-rule" aria-hidden="true" />
      <p className="slide-def">{known} of {deck.cards.length} terms marked known{saved ? `, ${saved} saved` : ''}.</p>
    </>
  );
}
