import { useState, useEffect, useCallback } from 'react';

interface DebouncedSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  delay?: number;
}

export const DebouncedSearch: React.FC<DebouncedSearchProps> = ({
  onSearch,
  placeholder = "Ara...",
  delay = 300
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const debouncedSearch = useCallback(
    (query: string) => {
      const timer = setTimeout(() => {
        onSearch(query);
        setIsTyping(false);
      }, delay);

      return () => clearTimeout(timer);
    },
    [onSearch, delay]
  );

  useEffect(() => {
    if (inputValue.trim() === '') {
      onSearch('');
      return;
    }

    setIsTyping(true);
    const cleanup = debouncedSearch(inputValue);
    return cleanup;
  }, [inputValue, debouncedSearch, onSearch]);

  return (
    <div style={{ position: 'relative', maxWidth: '400px' }}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 16px',
          paddingLeft: '40px',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.2s'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#3b82f6';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#e5e7eb';
        }}
      />
      
      {/* Search Icon */}
      <div style={{
        position: 'absolute',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#9ca3af',
        pointerEvents: 'none'
      }}>
        🔍
      </div>
      
      {/* Typing Indicator */}
      {isTyping && (
        <div style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          gap: '2px'
        }}>
          <div style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'pulse 1.4s infinite ease-in-out'
          }} />
          <div style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'pulse 1.4s infinite ease-in-out 0.2s'
          }} />
          <div style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'pulse 1.4s infinite ease-in-out 0.4s'
          }} />
        </div>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
