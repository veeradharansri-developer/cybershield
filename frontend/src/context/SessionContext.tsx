import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface SessionState {
  sessionId: string | null;
  filename: string | null;
  rows: number;
  cols: number;
  columns: string[];
  numericCols: string[];
  categoricalCols: string[];
  mapping: Record<string, string | null>;
  isCleaned: boolean;
  anomalyResults: {
    total: number;
    normal: number;
    anomalous: number;
    anomaly_pct: number;
    features_used: string[];
  } | null;
}

interface SessionContextType {
  session: SessionState;
  setSession: React.Dispatch<React.SetStateAction<SessionState>>;
  reset: () => void;
}

const STORAGE_KEY = 'cybershield_session';

const defaultSession: SessionState = {
  sessionId: null,
  filename: null,
  rows: 0,
  cols: 0,
  columns: [],
  numericCols: [],
  categoricalCols: [],
  mapping: {},
  isCleaned: false,
  anomalyResults: null,
};

function loadStoredSession(): SessionState {
  if (typeof window === 'undefined') return defaultSession;

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return defaultSession;

    const parsed = JSON.parse(value) as Partial<SessionState>;
    return {
      ...defaultSession,
      ...parsed,
      columns: parsed.columns ?? [],
      numericCols: parsed.numericCols ?? [],
      categoricalCols: parsed.categoricalCols ?? [],
      mapping: parsed.mapping ?? {},
      anomalyResults: parsed.anomalyResults ?? null,
    };
  } catch {
    return defaultSession;
  }
}

const SessionContext = createContext<SessionContextType>({
  session: defaultSession,
  setSession: () => {},
  reset: () => {},
});

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<SessionState>(() => loadStoredSession());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (session.sessionId) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const reset = () => {
    setSession(defaultSession);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <SessionContext.Provider value={{ session, setSession, reset }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
