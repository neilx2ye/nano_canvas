import { createContext, useCallback, useContext, useReducer } from 'react';
import type { TokenUsage } from '../types';

export interface TokenContextValue {
  usage: TokenUsage;
  recordUsage: (tokens: number) => void;
  resetTotal: () => void;
}

const INITIAL_USAGE: TokenUsage = {
  current: 0,
  total: 0,
};

type TokenAction =
  | { type: 'RECORD_USAGE'; payload: number }
  | { type: 'RESET_TOTAL' };

function tokenReducer(state: TokenUsage, action: TokenAction): TokenUsage {
  switch (action.type) {
    case 'RECORD_USAGE':
      return {
        current: action.payload,
        total: state.total + action.payload,
      };
    case 'RESET_TOTAL':
      return { ...state, total: 0 };
    default:
      return state;
  }
}

export const TokenContext = createContext<TokenContextValue | null>(null);

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [usage, dispatch] = useReducer(tokenReducer, INITIAL_USAGE);

  const recordUsage = useCallback((tokens: number) => {
    dispatch({ type: 'RECORD_USAGE', payload: tokens });
  }, []);

  const resetTotal = useCallback(() => {
    dispatch({ type: 'RESET_TOTAL' });
  }, []);

  return (
    <TokenContext.Provider value={{ usage, recordUsage, resetTotal }}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokenContext(): TokenContextValue {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useTokenContext must be used within a TokenProvider');
  }
  return context;
}
