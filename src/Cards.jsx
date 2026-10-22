import { useEffect, useRef, useState } from 'react';
import Icon from './icons.jsx';
import { EndCopy } from './Feed.jsx';

/** Classic flashcards: tap to flip, step through with the buttons, arrow keys or a swipe. */
export default function Cards({ deck, items, view, go, onUpdateCard }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = items.length;
  const atEnd = index >= total;
  const card = items[index];
  const known = deck.cards.filter((c) => c.known).length;
  const saved = deck.cards.filter((c) => c.starred).length;
  const touch = useRef(null);

  useEffect(() => { setIndex(0); setFlipped(false); }, [view.version]);

  const move = (delta) => {
    setIndex((i) => Math.max(0, Math.min(total, i + delta)));
    setFlipped(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea|select/i.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if ((e.key === ' ' || e.key === 'Enter') && card) { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === 's' && card) onUpdateCard(deck.id, card.id, { starred: !card.starred });
      else if (e.key === 'm' && card) onUpdateCard(deck.id, card.id, { known: !card.known });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  };

  if (atEnd) {
    return (
      <div className="cards">
        <div className="slide end static">
          <div className="slide-inner">
            <p className="slide-eyebrow"><span>End of set</span></p>
            <EndCopy total={total} known={known} saved={saved} deck={deck} filter={view.filter} />
            <div className="end-actions">
              {total > 0 && <button className="btn primary" onClick={() => move(-total)}>Back to start</button>}
              {view.filter !== 'learn' && known < deck.cards.length && <button className="btn" onClick={() => view.apply('learn', true)}>Review what’s left</button>}
              {view.filter !== 'all' && <button className="btn" onClick={() => view.apply('all', false)}>Show all</button>}
              <button className="btn" onClick={() => go('/')}>Library</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cards" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <p className="cards-count">{index + 1} / {total}</p>
      <button className={`flash ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Showing definition. Tap to see the term.' : 'Showing term. Tap to see the definition.'}>
        <span className="flash-face front">
          <span className="flash-kicker">Term{card.group ? ` · ${card.group}` : ''}</span>
          <span className="flash-text term">{card.term}</span>
          <span className="flash-hint">Tap to flip</span>
        </span>
        <span className="flash-face back">
          <span className="flash-kicker">Definition</span>
          <span className="flash-text">{card.definition}</span>
          {card.example && <span className="flash-example">{card.example}</span>}
          <span className="flash-hint">Tap to flip back</span>
        </span>
      </button>
      <div className="cards-actions">
        <button className={`act ${card.starred ? 'on' : ''}`} aria-pressed={!!card.starred} onClick={() => onUpdateCard(deck.id, card.id, { starred: !card.starred })}><Icon name="bookmark" size={20} /><span>{card.starred ? 'Saved' : 'Save'}</span></button>
        <button className={`act ${card.known ? 'on' : ''}`} aria-pressed={!!card.known} onClick={() => onUpdateCard(deck.id, card.id, { known: !card.known })}><Icon name="check" size={20} /><span>{card.known ? 'Known' : 'I know this'}</span></button>
      </div>
      <div className="cards-nav">
        <button className="btn" disabled={index === 0} onClick={() => move(-1)}><Icon name="back" size={17} /> Previous</button>
        <button className="btn primary" onClick={() => move(1)}>{index === total - 1 ? 'Finish' : 'Next'} <Icon name="chevron" size={17} /></button>
      </div>
    </div>
  );
}
