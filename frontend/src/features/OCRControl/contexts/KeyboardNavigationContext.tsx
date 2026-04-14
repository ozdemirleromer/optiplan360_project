import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { KeyboardNavigationState } from '../types';

type KeyboardNavigationAction =
  | { type: 'SELECT_CELL'; payload: { rowId: string; fieldId: string } }
  | { type: 'FOCUS_CELL'; payload: { rowId: string; fieldId: string } }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'EXPLICIT_APPROVE' };

interface KeyboardNavigationContextType {
  state: KeyboardNavigationState;
  actions: {
    selectCell: (rowId: string, fieldId: string) => void;
    focusCell: (rowId: string, fieldId: string) => void;
    moveRight: () => void;
    moveLeft: () => void;
    moveUp: () => void;
    moveDown: () => void;
    clearSelection: () => void;
    explicitApprove: () => void;
  };
}

const initialState: KeyboardNavigationState = {
  selectedCell: null,
  focusedCell: null
};

function keyboardNavigationReducer(
  state: KeyboardNavigationState, 
  action: KeyboardNavigationAction
): KeyboardNavigationState {
  switch (action.type) {
    case 'SELECT_CELL':
      return {
        ...state,
        selectedCell: action.payload,
        focusedCell: action.payload
      };
    
    case 'FOCUS_CELL':
      return {
        ...state,
        focusedCell: action.payload
      };
    
    case 'MOVE_RIGHT':
    case 'MOVE_LEFT':
    case 'MOVE_UP':
    case 'MOVE_DOWN':
    case 'CLEAR_SELECTION':
    case 'EXPLICIT_APPROVE':
      return state;
    
    default:
      return state;
  }
}

const KeyboardNavigationContext = createContext<KeyboardNavigationContextType | null>(null);

export const KeyboardNavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(keyboardNavigationReducer, initialState);

  const selectCell = useCallback((rowId: string, fieldId: string) => {
    dispatch({ type: 'SELECT_CELL', payload: { rowId, fieldId } });
  }, []);

  const focusCell = useCallback((rowId: string, fieldId: string) => {
    dispatch({ type: 'FOCUS_CELL', payload: { rowId, fieldId } });
  }, []);

  const moveRight = useCallback(() => {
    dispatch({ type: 'MOVE_RIGHT' });
  }, []);

  const moveLeft = useCallback(() => {
    dispatch({ type: 'MOVE_LEFT' });
  }, []);

  const moveUp = useCallback(() => {
    dispatch({ type: 'MOVE_UP' });
  }, []);

  const moveDown = useCallback(() => {
    dispatch({ type: 'MOVE_DOWN' });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const explicitApprove = useCallback(() => {
    dispatch({ type: 'EXPLICIT_APPROVE' });
  }, []);

  const actions = useMemo(
    () => ({
      selectCell,
      focusCell,
      moveRight,
      moveLeft,
      moveUp,
      moveDown,
      clearSelection,
      explicitApprove,
    }),
    [selectCell, focusCell, moveRight, moveLeft, moveUp, moveDown, clearSelection, explicitApprove],
  );

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Tab, Shift+Tab, Enter, Arrow keys, F2
      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          if (event.shiftKey) {
            actions.moveLeft();
          } else {
            actions.moveRight();
          }
          break;
        
        case 'Enter':
          event.preventDefault();
          actions.moveDown();
          break;
        
        case 'ArrowUp':
          event.preventDefault();
          actions.moveUp();
          break;
        
        case 'ArrowDown':
          event.preventDefault();
          actions.moveDown();
          break;
        
        case 'ArrowLeft':
          event.preventDefault();
          actions.moveLeft();
          break;
        
        case 'ArrowRight':
          event.preventDefault();
          actions.moveRight();
          break;
        
        case 'F2':
          event.preventDefault();
          actions.explicitApprove();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  return (
    <KeyboardNavigationContext.Provider value={{ state, actions }}>
      {children}
    </KeyboardNavigationContext.Provider>
  );
};

export const useKeyboardNavigation = () => {
  const context = useContext(KeyboardNavigationContext);
  if (!context) {
    throw new Error('useKeyboardNavigation must be used within KeyboardNavigationProvider');
  }
  return context;
};
