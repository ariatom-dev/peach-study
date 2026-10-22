import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase.js';

export function friendlyError(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  if (/Invalid login credentials/i.test(message)) return 'That email and password combination was not recognized.';
  if (/User already registered/i.test(message)) return 'An account with this email already exists. Try signing in instead.';
  if (/Email not confirmed/i.test(message)) return 'Please confirm your email using the link Supabase sent you, then sign in.';
  return message;
}

const signature = (d) => JSON.stringify([d.id, d.title, d.cards]);
const toRow = (userId, d) => ({
  user_id: userId,
  id: String(d.id),
  title: d.title || 'Untitled study set',
  cards: Array.isArray(d.cards) ? d.cards : [],
  created_at: d.createdAt || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

/**
 * Optional cloud sync. The app works fully without an account; signing in
 * (Settings → Account) merges this device's decks into the account and keeps
 * them in sync afterwards.
 */
export function useCloud({ decks, setDecks, readLocal, notify }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const migrationStarted = useRef(false);
  const synced = useRef(new Map()); // deck id -> signature last known to be in the cloud
  const userId = session?.user?.id;

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) notify(friendlyError(error), 'error');
      setSession(data?.session || null);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
      setLoaded(false);
      migrationStarted.current = false;
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the account's decks and merge in anything that only exists on this device.
  useEffect(() => {
    if (!supabase || !userId) return undefined;
    let alive = true;
    (async () => {
      setBusy(true);
      const { data, error } = await supabase
        .from('study_decks')
        .select('id,title,cards,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (!alive) return;
      if (error) {
        notify(`Cloud sync couldn't load your decks: ${friendlyError(error)} Check that you ran the SQL setup file.`, 'error');
        setBusy(false);
        setLoaded(true);
        return;
      }
      const cloudDecks = (data || []).map((row) => ({
        id: String(row.id),
        title: row.title,
        cards: Array.isArray(row.cards) ? row.cards : [],
        createdAt: row.created_at || new Date().toISOString(),
      }));
      synced.current = new Map(cloudDecks.map((d) => [d.id, signature(d)]));
      const cloudIds = new Set(cloudDecks.map((d) => d.id));
      const localOnly = readLocal().filter((d) => !cloudIds.has(String(d.id)));

      if (localOnly.length && !migrationStarted.current) {
        migrationStarted.current = true;
        const { error: migrateError } = await supabase
          .from('study_decks')
          .upsert(localOnly.map((d) => toRow(userId, d)), { onConflict: 'user_id,id' });
        if (!alive) return;
        if (migrateError) {
          notify(`Your cloud decks loaded, but local decks could not be copied up: ${friendlyError(migrateError)}`, 'error');
        } else {
          localOnly.forEach((d) => synced.current.set(String(d.id), signature(d)));
          cloudDecks.push(...localOnly.map((d) => ({ ...d, id: String(d.id) })));
          cloudDecks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          notify(`Synced ${localOnly.length} deck${localOnly.length === 1 ? '' : 's'} from this device to your account.`);
        }
      }
      setDecks(cloudDecks);
      setLoaded(true);
      setBusy(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Push only what changed, a moment after the last edit.
  useEffect(() => {
    if (!supabase || !userId || !loaded) return undefined;
    const changed = decks.filter((d) => synced.current.get(String(d.id)) !== signature(d));
    if (!changed.length) return undefined;
    const timer = setTimeout(async () => {
      const { error } = await supabase.from('study_decks').upsert(changed.map((d) => toRow(userId, d)), { onConflict: 'user_id,id' });
      if (error) notify(`Cloud save failed: ${friendlyError(error)}`, 'error');
      else changed.forEach((d) => synced.current.set(String(d.id), signature(d)));
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks, userId, loaded]);

  const deleteRemote = useCallback(async (id) => {
    synced.current.delete(String(id));
    if (!supabase || !userId) return;
    const { error } = await supabase.from('study_decks').delete().eq('user_id', userId).eq('id', String(id));
    if (error) notify(`Removed on this device, but cloud delete failed: ${friendlyError(error)}`, 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const submitAuth = useCallback(async (mode, email, password) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        return data.session
          ? { notice: 'Your account is ready. Your decks will now sync.' }
          : { notice: 'Account created. Check your email for a confirmation link, then sign in.', switchTo: 'login' };
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return { notice: 'Signed in. Loading your synced decks…' };
    } catch (error) {
      return { error: friendlyError(error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) notify(friendlyError(error), 'error');
    else {
      setDecks(readLocal());
      notify('Signed out. Your decks stay saved on this device.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    configured: supabaseConfigured,
    ready,
    busy,
    user: session?.user || null,
    submitAuth,
    signOut,
    deleteRemote,
  };
}
