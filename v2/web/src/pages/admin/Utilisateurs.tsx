import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Pencil, Search, UserPlus, Users } from 'lucide-react';
import { formatDateHeure, formatRelatif, ROLE_LABELS, ROLES, type Role } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { api, ApiError, messageErreur } from '../../lib/api';
import { Alert, Button, Checkbox, ConfirmDialog, Dialog, EmptyState, IconButton, LoadingRows, PageHeader, SelectField, TextField, useToast } from '../../ui';
import { champsErreur, useUsers } from '../../features/admin/hooks';
import type { UserAdmin } from '../../features/admin/types';
import '../../features/admin/admin.css';

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

function genererMotDePasse(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default function Utilisateurs() {
  const moi = useUser();
  const users = useUsers();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [etat, setEtat] = useState<'' | 'actif' | 'inactif'>('');
  const [creer, setCreer] = useState(false);
  const [edition, setEdition] = useState<UserAdmin | null>(null);
  const [reinit, setReinit] = useState<UserAdmin | null>(null);
  const [provisoire, setProvisoire] = useState<{ user: UserAdmin; mdp: string } | null>(null);

  const liste = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (users.data ?? []).filter(
      (u) =>
        (!t || `${u.nom} ${u.email} ${u.telephone ?? ''}`.toLowerCase().includes(t)) &&
        (!role || u.role === role) &&
        (!etat || (etat === 'actif' ? u.is_active : !u.is_active)),
    );
  }, [users.data, q, role, etat]);

  const nbActifs = users.data?.filter((u) => u.is_active).length;

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle={
          users.data ? `${nbActifs} ${nbActifs === 1 ? 'compte actif' : 'comptes actifs'} sur ${users.data.length}` : 'Comptes de l’équipe et droits d’accès'
        }
        actions={
          <Button variant="primary" icon={<UserPlus />} onClick={() => setCreer(true)}>
            Ajouter un utilisateur
          </Button>
        }
      />

      <div className="ev-filterbar">
        <div className="ev-search" style={{ maxWidth: 360 }}>
          <Search aria-hidden="true" />
          <input
            className="ev-input"
            style={{ height: 'var(--control-sm)', fontSize: 13 }}
            placeholder="Rechercher un nom, un e-mail, un téléphone"
            aria-label="Rechercher un utilisateur"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="ev-select" aria-label="Filtrer par rôle" value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
          <option value="">Tous les rôles</option>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="ev-select" aria-label="Filtrer par état" value={etat} onChange={(e) => setEtat(e.target.value as '' | 'actif' | 'inactif')}>
          <option value="">Actifs et inactifs</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Désactivés</option>
        </select>
      </div>

      {users.isError ? (
        <Alert tone="error">La liste des utilisateurs n'a pas pu être chargée : {messageErreur(users.error)}</Alert>
      ) : users.isLoading ? (
        <LoadingRows rows={6} />
      ) : liste.length === 0 ? (
        <div className="ev-card">
          <EmptyState title={users.data?.length ? 'Aucun utilisateur ne correspond' : 'Aucun utilisateur'} icon={<Users aria-hidden="true" />}>
            {users.data?.length ? 'Modifiez la recherche ou les filtres.' : 'Ajoutez les comptes de l’équipe avec « Ajouter un utilisateur ».'}
          </EmptyState>
        </div>
      ) : (
        <div className="ev-table-wrap">
          <table className="ev-table adm-dense">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                <th>État</th>
                <th>Dernière connexion</th>
                <th className="adm-num-th">Dossiers</th>
                <th className="ev-cell-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {liste.map((u) => (
                <tr key={u.id} className={u.is_active ? undefined : 'adm-tarif-inactive'}>
                  <td>
                    <span className="ev-cell-main">{u.nom}</span>
                    {u.id === moi.id && <span className="ev-muted"> (vous)</span>}
                    <span className="adm-sub">{u.email}</span>
                  </td>
                  <td className="nowrap">{ROLE_LABELS[u.role]}</td>
                  <td className="nowrap">{u.telephone ? <span className="ev-ref">{u.telephone}</span> : <span className="ev-muted">—</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="ev-badge ev-pay" data-pay={u.is_active ? 'paye' : 'non_paye'}>
                        {u.is_active ? 'Actif' : 'Désactivé'}
                      </span>
                      {u.doit_changer_mdp && u.is_active && (
                        <span
                          className="ev-badge ev-pay"
                          data-pay="partiel"
                          title="Mot de passe provisoire : la personne doit le changer à sa prochaine connexion"
                        >
                          Mot de passe provisoire
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="nowrap" title={u.last_login_at ? formatDateHeure(u.last_login_at) : undefined}>
                    {u.last_login_at ? formatRelatif(u.last_login_at) : <span className="ev-muted">Jamais connecté</span>}
                  </td>
                  <td className="ev-cell-num">{u.nb_dossiers}</td>
                  <td className="ev-cell-actions">
                    <div className="row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end', gap: 4 }}>
                      <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEdition(u)} aria-label={`Modifier ${u.nom}`}>
                        Modifier
                      </Button>
                      <IconButton
                        size="sm"
                        label={u.id === moi.id ? 'Changez votre propre mot de passe depuis Mon compte' : `Réinitialiser le mot de passe de ${u.nom}`}
                        disabled={u.id === moi.id}
                        onClick={() => setReinit(u)}
                      >
                        <KeyRound />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="adm-explain">
        Le nombre de dossiers compte les dossiers créés par la personne (préparateurs). Désactiver un compte ou changer son rôle ferme immédiatement ses
        sessions ouvertes ; ses dossiers et son historique sont conservés.
      </p>

      <CreerDialog open={creer} onClose={() => setCreer(false)} />
      <ModifierDialog user={edition} moiId={moi.id} onClose={() => setEdition(null)} />
      <ReinitDialog
        user={reinit}
        onClose={() => setReinit(null)}
        onDone={(user, mdp) => {
          setReinit(null);
          setProvisoire({ user, mdp });
        }}
      />
      <ProvisoireDialog data={provisoire} onClose={() => setProvisoire(null)} />
    </>
  );
}

const VIDE = { nom: '', email: '', role: 'preparateur' as Role, telephone: '', password: '' };

function CreerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF(VIDE);
      setErreurs({});
      setErreur(null);
    }
  }, [open]);
  const m = useMutation({
    mutationFn: () =>
      api.post<UserAdmin>('/users', { nom: f.nom.trim(), email: f.email.trim(), role: f.role, telephone: f.telephone.trim(), password: f.password }),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur ajouté', `${u.nom} devra changer son mot de passe à la première connexion.`);
      onClose();
    },
    onError: (e) => {
      const c = champsErreur(e);
      if (e instanceof ApiError && e.status === 409) c.email = e.message;
      setErreurs(c);
      setErreur(Object.keys(c).length ? null : messageErreur(e));
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!f.nom.trim()) local.nom = 'Indiquez le nom.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) local.email = 'Adresse e-mail invalide.';
    if (f.password.length < 8) local.password = 'Au moins 8 caractères.';
    setErreurs(local);
    if (Object.keys(local).length) return;
    m.mutate();
  };
  return (
    <Dialog
      open={open}
      onClose={() => !m.isPending && onClose()}
      title="Ajouter un utilisateur"
      description="La personne se connecte avec son e-mail et le mot de passe initial, puis choisit le sien."
      footer={
        <>
          <Button onClick={onClose} disabled={m.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="form-creer-user" busy={m.isPending}>
            Créer le compte
          </Button>
        </>
      }
    >
      <form id="form-creer-user" className="stack" onSubmit={submit} noValidate>
        {erreur && <Alert tone="error">{erreur}</Alert>}
        <TextField
          label="Nom complet"
          required
          data-autofocus
          value={f.nom}
          onChange={(e) => setF({ ...f, nom: e.target.value })}
          error={erreurs.nom}
          autoComplete="off"
        />
        <TextField
          label="E-mail"
          type="email"
          required
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          error={erreurs.email}
          autoComplete="off"
        />
        <div className="ev-form-grid">
          <SelectField
            label="Rôle"
            required
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value as Role })}
            options={ROLE_OPTIONS}
            error={erreurs.role}
          />
          <TextField
            label="Téléphone"
            type="tel"
            value={f.telephone}
            onChange={(e) => setF({ ...f, telephone: e.target.value })}
            error={erreurs.telephone}
            placeholder="77 000 00 00"
          />
        </div>
        <div className="stack-sm">
          <TextField
            label="Mot de passe initial"
            required
            mono
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            error={erreurs.password}
            help="Au moins 8 caractères. Communiquez-le à la personne : elle devra le changer à sa première connexion."
            autoComplete="new-password"
          />
          <div>
            <Button size="sm" variant="ghost" icon={<KeyRound />} onClick={() => setF({ ...f, password: genererMotDePasse() })}>
              Générer un mot de passe
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function ModifierDialog({ user, moiId, onClose }: { user: UserAdmin | null; moiId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ nom: '', email: '', role: 'preparateur' as Role, telephone: '', is_active: true });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (user) {
      setF({ nom: user.nom, email: user.email, role: user.role, telephone: user.telephone ?? '', is_active: user.is_active });
      setErreurs({});
      setErreur(null);
    }
  }, [user]);
  const soiMeme = user?.id === moiId;
  const changes = useMemo(() => {
    if (!user) return {};
    const c: Record<string, unknown> = {};
    if (f.nom.trim() !== user.nom) c.nom = f.nom.trim();
    if (f.email.trim().toLowerCase() !== user.email.toLowerCase()) c.email = f.email.trim();
    if (f.role !== user.role) c.role = f.role;
    if (f.telephone.trim() !== (user.telephone ?? '')) c.telephone = f.telephone.trim();
    if (f.is_active !== user.is_active) c.is_active = f.is_active;
    return c;
  }, [f, user]);
  const m = useMutation({
    mutationFn: () => api.patch<UserAdmin>(`/users/${user!.id}`, changes),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      const coupe = 'role' in changes || changes.is_active === false;
      toast.success(u.is_active ? 'Utilisateur modifié' : 'Compte désactivé', coupe ? `Les sessions ouvertes de ${u.nom} ont été fermées.` : undefined);
      onClose();
    },
    onError: (e) => {
      const c = champsErreur(e);
      if (e instanceof ApiError && e.status === 409) c.email = e.message;
      setErreurs(c);
      setErreur(Object.keys(c).length ? null : messageErreur(e));
    },
  });
  const nb = Object.keys(changes).length;
  return (
    <Dialog
      open={!!user}
      onClose={() => !m.isPending && onClose()}
      title={user ? `Modifier ${user.nom}` : 'Modifier'}
      footer={
        <>
          <Button onClick={onClose} disabled={m.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="form-modifier-user" busy={m.isPending} disabled={nb === 0}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="form-modifier-user"
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.nom.trim()) return setErreurs({ nom: 'Indiquez le nom.' });
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErreurs({ email: 'Adresse e-mail invalide.' });
          m.mutate();
        }}
      >
        {erreur && <Alert tone="error">{erreur}</Alert>}
        <TextField label="Nom complet" required value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} error={erreurs.nom} />
        <TextField label="E-mail" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={erreurs.email} />
        <div className="ev-form-grid">
          <SelectField
            label="Rôle"
            required
            value={f.role}
            disabled={soiMeme}
            onChange={(e) => setF({ ...f, role: e.target.value as Role })}
            options={ROLE_OPTIONS}
            error={erreurs.role}
            help={soiMeme ? 'Vous ne pouvez pas retirer votre propre rôle administrateur.' : undefined}
          />
          <TextField label="Téléphone" type="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} error={erreurs.telephone} />
        </div>
        <div className="stack-sm">
          <Checkbox label="Compte actif" checked={f.is_active} disabled={soiMeme} onChange={(v) => setF({ ...f, is_active: v })} />
          <span className="ev-help">
            {soiMeme
              ? 'Vous ne pouvez pas désactiver votre propre compte.'
              : 'Un compte désactivé ne peut plus se connecter ; ses dossiers et son historique restent visibles.'}
          </span>
        </div>
        {!soiMeme && ('role' in changes || changes.is_active === false) && (
          <Alert tone="warning">
            {changes.is_active === false ? 'La désactivation' : 'Le changement de rôle'} ferme immédiatement les sessions ouvertes de {user?.nom}.
          </Alert>
        )}
      </form>
    </Dialog>
  );
}

function ReinitDialog({ user, onClose, onDone }: { user: UserAdmin | null; onClose: () => void; onDone: (u: UserAdmin, mdp: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api.post<{ mot_de_passe_provisoire: string }>(`/users/${user!.id}/reinitialiser-mot-de-passe`),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onDone(user!, r.mot_de_passe_provisoire);
    },
    onError: (e) => toast.error('Le mot de passe n’a pas été réinitialisé', messageErreur(e)),
  });
  return (
    <ConfirmDialog
      open={!!user}
      onClose={() => !m.isPending && onClose()}
      onConfirm={() => m.mutate()}
      busy={m.isPending}
      title="Réinitialiser le mot de passe"
      confirmLabel="Réinitialiser le mot de passe"
      description={
        user
          ? `Un mot de passe provisoire va être généré pour ${user.nom}. L’ancien ne fonctionnera plus et ses sessions ouvertes seront fermées ; il devra en choisir un nouveau à la connexion.`
          : undefined
      }
    />
  );
}

function ProvisoireDialog({ data, onClose }: { data: { user: UserAdmin; mdp: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [copie, setCopie] = useState(false);
  useEffect(() => setCopie(false), [data]);
  return (
    <Dialog
      open={!!data}
      onClose={onClose}
      title="Mot de passe provisoire"
      description={data ? `Transmettez ce mot de passe à ${data.user.nom} (${data.user.email}).` : undefined}
      footer={
        <Button variant="primary" onClick={onClose}>
          J’ai noté le mot de passe
        </Button>
      }
    >
      {data && (
        <>
          <div className="adm-secret">
            <code aria-label="Mot de passe provisoire">{data.mdp}</code>
            <Button
              size="sm"
              icon={<Copy />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(data.mdp);
                  setCopie(true);
                } catch {
                  toast.error('La copie a échoué', 'Sélectionnez le mot de passe et copiez-le à la main.');
                }
              }}
            >
              {copie ? 'Copié' : 'Copier'}
            </Button>
          </div>
          <Alert tone="warning">Ce mot de passe ne sera plus affiché après la fermeture de cette fenêtre. S’il est perdu, réinitialisez-le de nouveau.</Alert>
        </>
      )}
    </Dialog>
  );
}
