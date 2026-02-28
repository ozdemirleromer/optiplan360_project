// Frontend Security Configuration

// Content Security Policy
// Add to index.html or configure in server
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _CSP_HEADER = {
  'Content-Security-Policy': (
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' http://127.0.0.1:8000 http://127.0.0.1:8080 https://api.optiplan360.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  )
};

// API Client Security Configuration
export const SECURITY_CONFIG = {
  // Request timeout
  timeout: 30000,
  
  // Retry configuration
  retryAttempts: 3,
  retryDelay: 1000,
  
  // Security headers
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  
  // CSRF token handling
  getCSRFToken: () => {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  },
  
  // Input sanitization
  sanitizeInput: (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  },
  
  // XSS prevention
  escapeHtml: (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Authentication Security
export const AUTH_SECURITY = {
  // Token storage
  tokenStorage: {
    setToken: (token: string) => {
      localStorage.setItem('optiplan-auth-token', token);
    },
    getToken: (): string | null => {
      return localStorage.getItem('optiplan-auth-token');
    },
    removeToken: () => {
      localStorage.removeItem('optiplan-auth-token');
    }
  },
  
  // Session management
  sessionTimeout: 3600000, // 1 hour
  
  // Password validation
  passwordValidation: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    validate: (password: string): boolean => {
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      return regex.test(password);
    }
  }
};

// Error Handling Security
export const ERROR_HANDLING = {
  // Don't expose sensitive information in error messages
  sanitizeError: (error: { response?: { status?: number } } | null | undefined): string => {
    if (error?.response?.status === 401) {
      return 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
    }
    if (error?.response?.status === 403) {
      return 'Bu işlem için yetkiniz bulunmuyor.';
    }
    if (error?.response?.status >= 500) {
      return 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
    }
    return 'İşlem sırasında bir hata oluştu.';
  },
  
  // Log security events
  logSecurityEvent: (event: string, details: unknown) => {
    console.warn(`Security Event: ${event}`, details);
    // In production, send to security monitoring service
  }
};
