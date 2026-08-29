'use client';

/**
 * The React binding for `tableStore`.
 *
 * The store is created PER MOUNT and handed down through context rather than living as a
 * module-level singleton: a singleton would be shared by every `/table/[sessionId]` a
 * process ever rendered, so one session's hand could leak into another's — and on the
 * server, across users. `useRef` gives each mounted table exactly one store, created once.
 */
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  createTableStore,
  type TableStore,
  type TableStoreInit,
  type TableStoreState,
} from '../../lib/table/tableStore.js';

const TableStoreContext = createContext<TableStore | null>(null);

export interface TableStoreProviderProps {
  readonly init: TableStoreInit;
  readonly children: ReactNode;
}

export function TableStoreProvider({ init, children }: TableStoreProviderProps) {
  const ref = useRef<TableStore | null>(null);
  ref.current ??= createTableStore(init);
  return <TableStoreContext.Provider value={ref.current}>{children}</TableStoreContext.Provider>;
}

/** The raw store handle, for `getState()` / imperative calls (the Phase 6 seam). */
export function useTableStoreApi(): TableStore {
  const store = useContext(TableStoreContext);
  if (store === null) {
    throw new Error('useTableStoreApi must be used inside <TableStoreProvider>');
  }
  return store;
}

/** Subscribe to one slice. */
export function useTableStore<T>(selector: (state: TableStoreState) => T): T {
  return useStore(useTableStoreApi(), selector);
}
