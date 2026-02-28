/**
 * Advanced RBAC (Role-Based Access Control)
 * Detaylı yetkilendirme sistemi
 */

import React from 'react';
import { create } from 'zustand';

export enum Permission {
  // Orders
  'orders.view' = 'orders.view',
  'orders.create' = 'orders.create',
  'orders.edit' = 'orders.edit',
  'orders.delete' = 'orders.delete',
  'orders.approve' = 'orders.approve',
  
  // Production
  'production.view' = 'production.view',
  'production.edit' = 'production.edit',
  'production.start' = 'production.start',
  'production.stop' = 'production.stop',
  
  // Finances
  'payment.view' = 'payment.view',
  'payment.create' = 'payment.create',
  'payment.approve' = 'payment.approve',
  
  // Admin
  'settings.view' = 'settings.view',
  'settings.edit' = 'settings.edit',
  'users.manage' = 'users.manage',
  'logs.view' = 'logs.view',
  'audit.view' = 'audit.view',
  
  // Reports
  'report.view' = 'report.view',
  'report.export' = 'report.export',
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  description?: string;
}

interface RBACState {
  roles: Role[];
  userRoles: Map<string, string[]>; // userId -> roleIds
  fieldPermissions: Map<string, Permission[]>; // fieldName -> permissions
  
  addRole: (role: Role) => void;
  updateRole: (id: string, updates: Partial<Role>) => void;
  deleteRole: (id: string) => void;
  assignRoleToUser: (userId: string, roleId: string) => void;
  checkPermission: (userId: string, permission: Permission) => boolean;
  checkFieldAccess: (userId: string, fieldName: string) => boolean;
}

export const useRBACStore = create<RBACState>((set, get) => ({
  roles: [
    {
      id: 'admin',
      name: 'Admin',
      permissions: Object.values(Permission),
      description: 'Tüm izinler',
    },
    {
      id: 'operator',
      name: 'Operatör',
      permissions: [
        Permission['orders.view'],
        Permission['orders.create'],
        Permission['orders.edit'],
        Permission['production.view'],
        Permission['production.start'],
        Permission['report.view'],
      ],
      description: 'Sipariş ve üretim yönetimi',
    },
    {
      id: 'viewer',
      name: 'Gözetmen',
      permissions: [
        Permission['orders.view'],
        Permission['production.view'],
        Permission['report.view'],
      ],
      description: 'Sadece görüntüleme',
    },
  ],

  userRoles: new Map(),
  fieldPermissions: new Map([
    ['cost', [Permission['settings.view']]],
    ['profit_margin', [Permission['settings.view']]],
    ['internal_notes', [Permission['settings.view']]],
  ]),

  addRole: (role) => {
    set((state) => ({
      roles: [...state.roles, role],
    }));
  },

  updateRole: (id, updates) => {
    set((state) => ({
      roles: state.roles.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
  },

  deleteRole: (id) => {
    set((state) => ({
      roles: state.roles.filter((r) => r.id !== id),
    }));
  },

  assignRoleToUser: (userId, roleId) => {
    set((state) => {
      const newMap = new Map(state.userRoles);
      const roles = newMap.get(userId) || [];
      if (!roles.includes(roleId)) {
        roles.push(roleId);
      }
      newMap.set(userId, roles);
      return { userRoles: newMap };
    });
  },

  checkPermission: (userId, permission) => {
    const state = get();
    const userRoleIds = state.userRoles.get(userId) || [];
    
    return userRoleIds.some((roleId) => {
      const role = state.roles.find((r) => r.id === roleId);
      return role?.permissions.includes(permission);
    });
  },

  checkFieldAccess: (userId, fieldName) => {
    const state = get();
    const requiredPermissions = state.fieldPermissions.get(fieldName) || [];
    
    return requiredPermissions.some((perm) =>
      state.userRoles.get(userId)?.some((roleId) => {
        const role = state.roles.find((r) => r.id === roleId);
        return role?.permissions.includes(perm);
      }),
    );
  },
}));

/**
 * usePermission Hook
 */
export const usePermission = () => {
  const { checkPermission, checkFieldAccess } = useRBACStore();
  const userId = 'current-user-id'; // From auth store

  const can = (permission: Permission) => checkPermission(userId, permission);
  const canAccess = (fieldName: string) => checkFieldAccess(userId, fieldName);

  return { can, canAccess };
};

/**
 * Permission Guard Component
 */
interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const rbac = useRBACStore();
  const userId = 'current-user-id'; // From auth store

  if (rbac.checkPermission(userId, permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Field-level Permission Guard
 */
interface FieldGuardProps {
  field: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FieldGuard: React.FC<FieldGuardProps> = ({
  field,
  children,
  fallback = '***',
}) => {
  const rbac = useRBACStore();
  const userId = 'current-user-id'; // From auth store

  if (rbac.checkFieldAccess(userId, field)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
