import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@evocom/shared';
import { api, setUnauthorizedHandler } from '../lib/api';
import { connectRealtime, disconnectRealtime } from '../lib/realtime';
import { synchroniserPreferences } from '../lib/theme';
import type { User } from '../lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const Ctx = createContext<AuthCtx | null>(null);

function viderSaufMoi(qc: QueryClient) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await api.get<{ user: User }>('/auth/me')).user;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.setQueryData(['me'], null);
    });
  }, [qc]);

  const user = me.data ?? null;
  useEffect(() => {
    if (user) connectRealtime();
    else disconnectRealtime();
  }, [user]);

  const userId = user?.id;
  useEffect(() => {
    if (userId) void synchroniserPreferences();
  }, [userId]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.post<{ user: User }>('/auth/login', { email, password });
      // Vider les données de la session précédente, sauf la requête « me » : AuthProvider l'observe, et la supprimer
      // détacherait son observateur (l'utilisateur connecté resterait invisible et l'écran reviendrait à la connexion).
      viderSaufMoi(qc);
      qc.setQueryData(['me'], r.user);
      return r.user;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    disconnectRealtime();
    viderSaufMoi(qc);
    qc.setQueryData(['me'], null);
  }, [qc]);

  const value = useMemo<AuthCtx>(() => ({ user, loading: me.isLoading, login, logout, refresh: me.refetch }), [user, me.isLoading, login, logout, me.refetch]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth hors AuthProvider');
  return c;
}

/** L'utilisateur connecté (à utiliser sous RequireAuth). */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('Utilisateur non connecté');
  return user;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="page-loading">Chargement…</div>;
  if (!user) return <Navigate to="/connexion" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function accueilPour(role: Role): string {
  switch (role) {
    case 'admin':
      return '/tableau-de-bord';
    case 'preparateur':
      return '/dossiers';
    case 'imprimeur_roland':
    case 'imprimeur_xerox':
      return '/atelier';
    case 'livreur':
      return '/livraisons';
  }
}
