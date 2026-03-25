import React, { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import { appReducer, makeInitialState, type AppState, type AppAction } from './AppState.js';

interface StateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const StateContext = createContext<StateContextValue | undefined>(undefined);

interface StateProviderProps {
  children: ReactNode;
  maxLines?: number;
}

export function StateProvider({ children, maxLines }: StateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, makeInitialState(maxLines));

  return (
    <StateContext.Provider value={{ state, dispatch }}>
      {children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
}
