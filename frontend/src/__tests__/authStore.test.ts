import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

const mockUser: User = {
  id: '1',
  username: 'test',
  email: '',
  role: 'OPERATOR',
  active: true,
  createdAt: new Date().toISOString(),
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useAuthStore.getState();
    store.logout();
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('should login successfully', () => {
    const { result } = renderHook(() => useAuthStore());
    
    act(() => {
      // Store login imzası: login(token, user)
      result.current.login('test-token', mockUser);
    });
    
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('test');
    expect(result.current.token).toBe('test-token');
  });

  it('should logout successfully', () => {
    const { result } = renderHook(() => useAuthStore());
    
    act(() => {
      result.current.login('test-token', mockUser);
    });
    
    act(() => {
      result.current.logout();
    });
    
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('should preserve user data after login', () => {
    const { result } = renderHook(() => useAuthStore());
    
    act(() => {
      result.current.login('test-token', mockUser);
    });
    
    expect(result.current.user?.id).toBe('1');
    expect(result.current.user?.role).toBe('OPERATOR');
    expect(result.current.isAuthenticated).toBe(true);
  });
});
