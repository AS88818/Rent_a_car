import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserRole } from '../types/database';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  branchId: string | null;
  loading: boolean;
  signUp: (identifier: string, password: string, fullName: string, role: UserRole, branchId?: string, contactType?: 'email' | 'phone') => Promise<void>;
  signIn: (identifier: string, password: string, contactType?: 'email' | 'phone') => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          const role = (session.user.app_metadata?.role as UserRole) || 'staff';
          setUserRole(role);
          setBranchId((session.user.app_metadata?.branch_id as string) || null);
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const role = (session.user.app_metadata?.role as UserRole) || 'staff';
        setUserRole(role);
        setBranchId((session.user.app_metadata?.branch_id as string) || null);
      } else {
        setUser(null);
        setUserRole(null);
        setBranchId(null);
      }
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (identifier: string, password: string, fullName: string, role: UserRole, branchId?: string, contactType: 'email' | 'phone' = 'email') => {
    const signUpData = contactType === 'phone'
      ? {
          phone: identifier,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
              branch_id: branchId || null,
            },
          },
        }
      : {
          email: identifier,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
              branch_id: branchId || null,
            },
          },
        };

    const { error } = await supabase.auth.signUp(signUpData);
    if (error) throw error;
  };

  const signIn = async (identifier: string, password: string, contactType: 'email' | 'phone' = 'email') => {
    const signInData = contactType === 'phone'
      ? { phone: identifier, password }
      : { email: identifier, password };

    const { error } = await supabase.auth.signInWithPassword(signInData);
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
      setUserRole(null);
      setBranchId(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setUser(null);
      setUserRole(null);
      setBranchId(null);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      if (session?.user) {
        setUser(session.user);
        const role = (session.user.app_metadata?.role as UserRole) || 'staff';
        setUserRole(role);
        setBranchId((session.user.app_metadata?.branch_id as string) || null);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      throw error;
    }
  };

  const value = {
    user,
    userRole,
    branchId,
    loading,
    signUp,
    signIn,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
