import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LogOut, Menu, Moon, Search, Sun, SunMoon, Wifi, WifiOff } from 'lucide-react';
import { ROLE_LABELS } from '@evocom/shared';
import { useAuth, useUser } from '../auth/AuthContext';
import { api } from '../lib/api';
import { onConnexion } from '../lib/realtime';
import { applyTheme, getTheme, type Theme } from '../lib/theme';
import { NotificationBell } from './NotificationBell';
import { navigationPour } from './nav';

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<Theme, string> = { system: 'Thème : automatique', light: 'Thème : clair', dark: 'Thème : sombre' };

export function AppShell() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [online, setOnline] = useState(true);
  const [q, setQ] = useState('');
  const sections = useMemo(() => navigationPour(user.role), [user.role]);
  const mobileItems = sections.flatMap((s) => s.items).filter((i) => i.mobile).slice(0, 4);

  useEffect(() => onConnexion(setOnline), []);
  useEffect(() => setOpen(false), [loc.pathname]);

  const compteurs = useQuery({
    queryKey: ['paiements', 'compteur'],
    queryFn: () => api.get<{ total: number }>('/paiements', { statut: 'a_valider', limit: 1 }),
    enabled: user.role === 'admin',
    refetchInterval: 60_000,
    retry: false,
  });
  const counts: Record<string, number | undefined> = { paiements_a_valider: compteurs.data?.total };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : SunMoon;

  return (
    <div className="ev-shell">
      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className="ev-sidebar" data-open={open} aria-label="Navigation principale">
        <a className="ev-brand" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          Evocom <span>Print</span>
        </a>
        <nav className="ev-nav">
          {sections.map((s, i) => (
            <div key={i} className="ev-nav" style={{ gap: 2 }}>
              {s.title && <div className="ev-nav-section">{s.title}</div>}
              {s.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/livraisons'} className="ev-nav-item"
                  aria-current={undefined}
                  style={undefined}
                  // NavLink pose aria-current="page" sur l'élément actif
                >
                  <item.icon aria-hidden="true" />
                  {item.label}
                  {item.countKey && counts[item.countKey] ? <span className="ev-count">{counts[item.countKey]}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="ev-user">
          <span className="ev-avatar" aria-hidden="true">{initiales(user.nom)}</span>
          <div className="grow">
            <div style={{ fontWeight: 500 }} className="truncate">{user.nom}</div>
            <div className="ev-muted" style={{ fontSize: 12 }}>{ROLE_LABELS[user.role]}</div>
          </div>
          <button className="ev-icon-btn ev-icon-btn--sm" aria-label="Mon compte" title="Mon compte" onClick={() => navigate('/profil')}>
            <KeyRound />
          </button>
          <button className="ev-icon-btn ev-icon-btn--sm" aria-label="Se déconnecter" title="Se déconnecter" onClick={() => void logout().then(() => navigate('/connexion'))}>
            <LogOut />
          </button>
        </div>
      </aside>
      <div className="ev-main">
        <header className="ev-topbar">
          <button className="ev-icon-btn menu-btn" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          {user.role !== 'livreur' && (
            <form
              className="ev-search"
              role="search"
              style={{ maxWidth: 420 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) navigate(`/dossiers?q=${encodeURIComponent(q.trim())}`);
              }}
            >
              <Search aria-hidden="true" />
              <input className="ev-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un dossier, un client, un numéro" aria-label="Rechercher" />
            </form>
          )}
          <span className="ev-topbar__spacer" />
          <span className="ev-muted row" style={{ fontSize: 12 }} title={online ? 'Mises à jour en direct actives' : 'Connexion temps réel interrompue : les données se rechargent à intervalle régulier'}>
            {online ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
            <span className="sr-only">{online ? 'En direct' : 'Hors ligne'}</span>
          </span>
          <button
            className="ev-icon-btn"
            aria-label={THEME_LABEL[theme]}
            title={THEME_LABEL[theme]}
            onClick={() => {
              const t = THEME_NEXT[theme];
              setTheme(t);
              applyTheme(t);
            }}
          >
            <ThemeIcon />
          </button>
          <NotificationBell />
        </header>
        <main className="ev-page" id="contenu">
          <Outlet />
        </main>
      </div>
      {mobileItems.length > 1 && (
        <nav className="ev-tabbar" aria-label="Navigation rapide">
          {mobileItems.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/livraisons'}>
              <i.icon aria-hidden="true" />
              {i.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
