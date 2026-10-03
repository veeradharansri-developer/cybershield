import React, { createContext, useContext, useState } from 'react';
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

const SessionContext = createContext<SessionContextType>({
  session: defaultSession,
  setSession: () => {},
  reset: () => {},
});

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<SessionState>(defaultSession);
  const reset = () => setSession(defaultSession);
  return (
    <SessionContext.Provider value={{ session, setSession, reset }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
