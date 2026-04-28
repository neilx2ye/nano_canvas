import { createContext, useCallback, useContext, useReducer } from 'react';
import type { GenerationConfig } from '../types';
import { sanitizeGenerationConfig } from '../constants/geminiImageModels';

export interface ConfigContextValue {
  config: GenerationConfig;
  updateConfig: (updates: Partial<GenerationConfig>) => void;
  loadConfig: (nextConfig: Partial<GenerationConfig>) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG: GenerationConfig = {
  model: 'nano-banana-2',
  prompt: '',
  width: 1024,
  height: 1024,
  aspectRatio: '1:1',
  imageSize: '1K',
  // v2 默认值
  thinkingLevel: 'low',
  thinkingBudget: 2000,
  maskMode: false,
};

type ConfigAction =
  | { type: 'UPDATE_CONFIG'; payload: Partial<GenerationConfig> }
  | { type: 'LOAD_CONFIG'; payload: Partial<GenerationConfig> }
  | { type: 'RESET_CONFIG' };

function configReducer(state: GenerationConfig, action: ConfigAction): GenerationConfig {
  switch (action.type) {
    case 'UPDATE_CONFIG':
      return sanitizeGenerationConfig({ ...state, ...action.payload });
    case 'LOAD_CONFIG':
      return sanitizeGenerationConfig({ ...DEFAULT_CONFIG, ...action.payload });
    case 'RESET_CONFIG':
      return DEFAULT_CONFIG;
    default:
      return state;
  }
}

export const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, dispatch] = useReducer(configReducer, DEFAULT_CONFIG);

  const updateConfig = useCallback((updates: Partial<GenerationConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: updates });
  }, []);

  const loadConfig = useCallback((nextConfig: Partial<GenerationConfig>) => {
    dispatch({ type: 'LOAD_CONFIG', payload: nextConfig });
  }, []);

  const resetConfig = useCallback(() => {
    dispatch({ type: 'RESET_CONFIG' });
  }, []);

  return (
    <ConfigContext.Provider value={{ config, updateConfig, loadConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfigContext(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfigContext must be used within a ConfigProvider');
  }
  return context;
}
