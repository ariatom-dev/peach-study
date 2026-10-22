export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Make sure every card has a stable id (older decks saved before ids existed get deterministic ones). */
export function normalizeDeck(deck) {
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  return {
    ...deck,
    id: String(deck.id),
    cards: cards.map((c, i) => (c.id ? c : { ...c, id: `${deck.id}-${i}` })),
  };
}

export const normalizeDecks = (decks) => (Array.isArray(decks) ? decks.map(normalizeDeck) : []);
