import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { OCRRow, DocumentInfo, BlockerInfo, ViewState, CRITICAL_FIELDS } from '../types';

interface OCRDataState {
  rows: OCRRow[];
  document: DocumentInfo | null;
  currentView: ViewState;
  blockerInfo: BlockerInfo;
  selectedRow: string | null;
  selectedField: { rowId: string; fieldId: string } | null;
}

type OCRDataAction =
  | { type: 'SET_LOADING' }
  | { type: 'SET_EMPTY' }
  | { type: 'SET_READY' }
  | { type: 'SET_IMAGE_ERROR' }
  | { type: 'SET_SAVE_ERROR' }
  | { type: 'SET_DATA'; payload: { rows: OCRRow[]; document: DocumentInfo } }
  | { type: 'UPDATE_FIELD'; payload: { rowId: string; fieldId: string; value: string } }
  | { type: 'APPROVE_FIELD'; payload: { rowId: string; fieldId: string } }
  | { type: 'SELECT_FIELD'; payload: { rowId: string; fieldId: string } | null }
  | { type: 'SELECT_ROW'; payload: string | null }
  | { type: 'REFRESH_DATA' }
  | { type: 'MARK_FAULTY' };

const initialState: OCRDataState = {
  rows: [],
  document: null,
  currentView: 'loading',
  blockerInfo: {
    hasBlockers: false,
    unapprovedLowConfidenceCount: 0,
    totalCriticalFields: 0,
    approvedCount: 0,
    message: ''
  },
  selectedRow: null,
  selectedField: null
};

function calculateBlockerInfo(rows: OCRRow[]): BlockerInfo {
  let totalCriticalFields = 0;
  let approvedCount = 0;
  let unapprovedLowConfidenceCount = 0;

  rows.forEach(row => {
    Object.values(row.fields).forEach(field => {
      if (CRITICAL_FIELDS.some((criticalField) => criticalField === field.name)) {
        totalCriticalFields++;
        if (field.isApproved) {
          approvedCount++;
        }
        if (field.confidence < 80 && !field.isApproved) {
          unapprovedLowConfidenceCount++;
        }
      }
    });
  });

  const hasBlockers = unapprovedLowConfidenceCount > 0;
  const message = hasBlockers
    ? `${unapprovedLowConfidenceCount} hücre onay bekliyor`
    : 'Tüm kritik alanlar onaylandı';

  return {
    hasBlockers,
    unapprovedLowConfidenceCount,
    totalCriticalFields,
    approvedCount,
    message
  };
}

function ocrDataReducer(state: OCRDataState, action: OCRDataAction): OCRDataState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, currentView: 'loading' };
    
    case 'SET_EMPTY':
      return {
        ...state,
        currentView: 'empty',
        rows: [],
        document: null,
        blockerInfo: {
          hasBlockers: false,
          unapprovedLowConfidenceCount: 0,
          totalCriticalFields: 0,
          approvedCount: 0,
          message: '',
        },
        selectedRow: null,
        selectedField: null,
      };
    
    case 'SET_READY':
      return { ...state, currentView: 'ready' };
    
    case 'SET_IMAGE_ERROR':
      return { ...state, currentView: 'image-error' };
    
    case 'SET_SAVE_ERROR':
      return { ...state, currentView: 'save-error' };
    
    case 'SET_DATA': {
      const blockerInfo = calculateBlockerInfo(action.payload.rows);
      return {
        ...state,
        rows: action.payload.rows,
        document: action.payload.document,
        currentView: 'ready',
        blockerInfo
      };
    }
    
    case 'UPDATE_FIELD': {
      const updatedRows = state.rows.map(row => {
        if (row.id === action.payload.rowId) {
          const updatedFields = {
            ...row.fields,
            [action.payload.fieldId]: {
              ...row.fields[action.payload.fieldId],
              value: action.payload.value,
              isOverridden: true
            }
          };
          return { ...row, fields: updatedFields };
        }
        return row;
      });

      const newBlockerInfo = calculateBlockerInfo(updatedRows);
      return {
        ...state,
        rows: updatedRows,
        blockerInfo: newBlockerInfo
      };
    }
    
    case 'APPROVE_FIELD': {
      const approvedRows = state.rows.map(row => {
        if (row.id === action.payload.rowId) {
          const approvedFields = {
            ...row.fields,
            [action.payload.fieldId]: {
              ...row.fields[action.payload.fieldId],
              isApproved: true
            }
          };
          return { ...row, fields: approvedFields };
        }
        return row;
      });

      const approvedBlockerInfo = calculateBlockerInfo(approvedRows);
      return {
        ...state,
        rows: approvedRows,
        blockerInfo: approvedBlockerInfo
      };
    }
    
    case 'SELECT_FIELD':
      return { ...state, selectedField: action.payload };
    
    case 'SELECT_ROW':
      return { ...state, selectedRow: action.payload };
    
    case 'REFRESH_DATA':
      return { ...state, currentView: 'loading' };
    
    case 'MARK_FAULTY':
      return { ...state, currentView: 'faulty-modal-open' };
    
    default:
      return state;
  }
}

interface OCRDataContextType {
  state: OCRDataState;
  actions: {
    setLoading: () => void;
    setEmpty: () => void;
    setReady: () => void;
    setImageError: () => void;
    setSaveError: () => void;
    setData: (rows: OCRRow[], document: DocumentInfo) => void;
    updateField: (rowId: string, fieldId: string, value: string) => void;
    approveField: (rowId: string, fieldId: string) => void;
    selectField: (selection: { rowId: string; fieldId: string } | null) => void;
    selectRow: (rowId: string | null) => void;
    refreshData: () => void;
    markFaulty: () => void;
  };
}

const OCRDataContext = createContext<OCRDataContextType | null>(null);

export const OCRDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(ocrDataReducer, initialState);

  const actions = {
    setLoading: useCallback(() => dispatch({ type: 'SET_LOADING' }), []),
    setEmpty: useCallback(() => dispatch({ type: 'SET_EMPTY' }), []),
    setReady: useCallback(() => dispatch({ type: 'SET_READY' }), []),
    setImageError: useCallback(() => dispatch({ type: 'SET_IMAGE_ERROR' }), []),
    setSaveError: useCallback(() => dispatch({ type: 'SET_SAVE_ERROR' }), []),
    setData: useCallback((rows: OCRRow[], document: DocumentInfo) => 
      dispatch({ type: 'SET_DATA', payload: { rows, document } }), []),
    updateField: useCallback((rowId: string, fieldId: string, value: string) => 
      dispatch({ type: 'UPDATE_FIELD', payload: { rowId, fieldId, value } }), []),
    approveField: useCallback((rowId: string, fieldId: string) => 
      dispatch({ type: 'APPROVE_FIELD', payload: { rowId, fieldId } }), []),
    selectField: useCallback((selection: { rowId: string; fieldId: string } | null) => 
      dispatch({ type: 'SELECT_FIELD', payload: selection }), []),
    selectRow: useCallback((rowId: string | null) => 
      dispatch({ type: 'SELECT_ROW', payload: rowId }), []),
    refreshData: useCallback(() => dispatch({ type: 'REFRESH_DATA' }), []),
    markFaulty: useCallback(() => dispatch({ type: 'MARK_FAULTY' }), []),
  };

  return (
    <OCRDataContext.Provider value={{ state, actions }}>
      {children}
    </OCRDataContext.Provider>
  );
};

export const useOCRData = () => {
  const context = useContext(OCRDataContext);
  if (!context) {
    throw new Error('useOCRData must be used within OCRDataProvider');
  }
  return context;
};
