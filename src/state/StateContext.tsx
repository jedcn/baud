import React, { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import { type AppAction, type AppState, appReducer, initialState } from './AppState.js';

interface StateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const StateContext = createContext<StateContextValue | undefined>(undefined);

interface StateProviderProps {
  children: ReactNode;
}

export function StateProvider({ children }: StateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return <StateContext.Provider value={{ state, dispatch }}>{children}</StateContext.Provider>;
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
}
