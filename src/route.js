import { useCallback, useEffect, useState } from 'react';

/** Tiny hash router so the Safari/home-screen back gesture works: #/, #/create, #/settings, #/study/<id> */
function read() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = parts[0] || 'library';
  if (name === 'study' && parts[1]) return { name, id: decodeURIComponent(parts[1]) };
  if (name === 'create' || name === 'settings') return { name };
  return { name: 'library' };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((path) => {
    window.location.hash = path;
  }, []);
  return [route, go];
}
