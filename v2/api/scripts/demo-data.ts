// Remplit une base de démonstration en passant par l'API, comme le feraient les utilisateurs.
// Usage : API_URL=http://127.0.0.1:4000 npx tsx scripts/demo-data.ts
// À n'utiliser que sur une base de test (comptes créés par `npm run seed -- --demo`).

const BASE = process.env.API_URL ?? 'http://127.0.0.1:4000';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Evocom2026!';

class Client {
  cookie = '';
  constructor(public email: string) {}
  async login() {
    const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: this.email, password: PASSWORD }) });
    if (!r.ok) throw new Error(`Connexion ${this.email} : ${r.status}`);
    this.cookie = (r.headers.get('set-cookie') ?? '').split(';')[0]!;
    return this;
  }
  async req(method: string, path: string, body?: unknown) {
    const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: this.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t}`);
    return t ? JSON.parse(t) : null;
  }
  async upload(dossierId: number, nom: string, contenu: Buffer, type = 'application/pdf') {
    const b64 = (s: string) => Buffer.from(s).toString('base64');
    const c = await fetch(`${BASE}/api/uploads`, {
      method: 'POST',
      headers: { Cookie: this.cookie, 'Tus-Resumable': '1.0.0', 'Upload-Length': String(contenu.length), 'Upload-Metadata': `dossierId ${b64(String(dossierId))},filename ${b64(nom)},filetype ${b64(type)}` },
    });
    if (c.status !== 201) throw new Error(`upload create ${c.status} ${await c.text()}`);
    const loc = c.headers.get('location')!;
    const url = loc.startsWith('http') ? loc : `${BASE}${loc.startsWith('/') ? '' : '/api/uploads/'}${loc}`;
    const p = await fetch(url, { method: 'PATCH', headers: { Cookie: this.cookie, 'Tus-Resumable': '1.0.0', 'Upload-Offset': '0', 'Content-Type': 'application/offset+octet-stream' }, body: contenu });
    if (p.status !== 204) throw new Error(`upload patch ${p.status} ${await p.text()}`);
  }
}

function pdf(titre: string): Buffer {
  // PDF minimal valide d'une page avec un titre, pour les aperçus.
  const stream = `BT /F1 28 Tf 72 720 Td (${titre.replace(/[()\\]/g, '')}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const R = (support: string, l: number, h: number, q: number, finitions: string[] = []) => ({ support, largeur: l, hauteur: h, unite: 'cm', quantite: q, finitions: finitions.map((code) => ({ code })), options: [] });
const X = (support: string, pages: number, q: number, rv = false, finitions: string[] = []) => ({ support, pages, recto_verso: rv, quantite: q, finitions: finitions.map((code) => ({ code })), options: [] });

const DOSSIERS = [
  { m: 'roland', c: 'Boutique Keur Yaye', t: '77 412 58 90', d: 'Bâche façade boutique', l: [R('bache_m2', 300, 200, 1, ['coupage_decoupe'])], u: true, fin: 'pret_impression', adr: 'Sacré-Cœur 3, villa 112' },
  { m: 'roland', c: 'Pharmacie Ndiaye', t: '78 220 14 33', d: 'Vitrophanie horaires', l: [R('vinyle_m2', 120, 80, 4)], fin: 'pret_impression' },
  { m: 'roland', c: 'École Les Pédagogues', t: '76 554 10 02', d: 'Kakémono rentrée', l: [R('bache_m2', 85, 200, 2)], fin: 'en_impression' },
  { m: 'roland', c: 'Restaurant Le Lagon', t: '77 300 45 67', d: 'Affiches menu', l: [R('papier_photo_m2', 60, 90, 6, ['pelliculage'])], fin: 'pret_livraison', adr: 'Route de la Corniche Ouest' },
  { m: 'roland', c: 'Cabinet Diallo & Associés', t: '70 112 98 76', d: 'Toile salle d\'attente', l: [R('toile_canvas_m2', 100, 70, 1)], fin: 'a_revoir', rev: 'Le fichier est en RVB et à 72 dpi. Merci de fournir un PDF en CMJN à 150 dpi minimum.' },
  { m: 'roland', c: 'Mairie de Pikine', t: '33 834 11 20', d: 'Banderoles journée de salubrité', l: [R('bache_m2', 500, 100, 3, ['coupage_decoupe'])], fin: 'livre', pay: 'complet' },
  { m: 'xerox', c: 'Mairie de Pikine', t: '33 834 11 20', d: 'Flyers A4 campagne', l: [X('papier_a4_couleur', 1, 500)], fin: 'pret_impression', u: true },
  { m: 'xerox', c: 'Lycée Blaise Diagne', t: '33 821 45 90', d: 'Sujets d\'examen blanc', l: [X('papier_a4_nb', 6, 120, true, ['agrafage'])], fin: 'en_cours' },
  { m: 'xerox', c: 'Cabinet Diallo & Associés', t: '70 112 98 76', d: 'Rapport annuel relié', l: [X('papier_a4_couleur', 40, 15, true, ['reliure_thermique'])], fin: 'en_impression' },
  { m: 'xerox', c: 'Association Jappo', t: '77 908 12 34', d: 'Programmes du gala', l: [X('papier_a3_couleur', 2, 200)], fin: 'pret_livraison', adr: 'Mermoz, rue MZ-84' },
  { m: 'xerox', c: 'Boutique Keur Yaye', t: '77 412 58 90', d: 'Cartes de fidélité', l: [X('papier_a4_couleur', 1, 50, true, ['plastification'])], fin: 'en_livraison', adr: 'Sacré-Cœur 3, villa 112', pay: 'acompte' },
  { m: 'xerox', c: 'Clinique du Golf', t: '33 869 00 11', d: 'Formulaires patients', l: [X('papier_a4_nb', 2, 1000)], fin: 'livre', pay: 'a_valider' },
  { m: 'xerox', c: 'Restaurant Le Lagon', t: '77 300 45 67', d: 'Menus plastifiés', l: [X('papier_a4_couleur', 2, 30, true, ['plastification'])], fin: 'termine', pay: 'complet' },
  { m: 'roland', c: 'Garage Sall Auto', t: '76 120 33 44', d: 'Enseigne atelier', l: [R('bache_m2', 400, 120, 1, ['coupage_decoupe'])], fin: 'en_cours' },
];

async function main() {
  const prep = await new Client('prep@evocom.test').login();
  const roland = await new Client('roland@evocom.test').login();
  const xerox = await new Client('xerox@evocom.test').login();
  const liv = await new Client('livreur@evocom.test').login();
  const admin = await new Client('admin@evocom.test').login();
  // Prix de démonstration pour les tarifs que la grille de départ laisse vides.
  const tarifs = await admin.req('GET', '/tarifs');
  const demo: Record<string, number> = { agrafage: 100, oeillets: 150, ourlet: 500, mesh_m2: 8000, papier_a5_couleur: 60, carte_visite: 25 };
  for (const t of tarifs) if (t.prix === null && demo[t.code] !== undefined) await admin.req('PATCH', `/tarifs/${t.id}`, { prix: demo[t.code] });
  const ordre = ['en_cours', 'pret_impression', 'en_impression', 'pret_livraison', 'en_livraison', 'livre', 'termine'];
  for (const [i, s] of DOSSIERS.entries()) {
    const promise = new Date(Date.now() + ((i % 5) - 1) * 86400000).toISOString().slice(0, 10);
    const d = await prep.req('POST', '/dossiers', {
      machine: s.m, client_nom: s.c, client_telephone: s.t, description: s.d,
      specs: { lignes: s.l, forfaits: [] }, urgent: !!s.u, date_promise: promise, adresse_livraison: s.adr ?? null,
      mode_paiement_prevu: i % 3 === 0 ? 'wave' : 'especes',
    });
    const imp = s.m === 'roland' ? roland : xerox;
    if (s.fin === 'en_cours') continue;
    await prep.upload(d.id, `${s.d.toLowerCase().replace(/[^a-z0-9àâäéèêëîïôöùûüç]+/gi, '-')}-HD.pdf`, pdf(`${d.numero} ${s.c}`));
    if (i % 4 === 0) await prep.upload(d.id, 'logo-client.pdf', pdf('Logo'));
    await prep.req('POST', `/dossiers/${d.id}/actions/valider`, {});
    if (s.fin === 'a_revoir') {
      await imp.req('POST', `/dossiers/${d.id}/actions/demander_revision`, { commentaire: s.rev });
      continue;
    }
    const cible = ordre.indexOf(s.fin);
    if (cible >= 2) await imp.req('POST', `/dossiers/${d.id}/actions/demarrer`, {});
    if (cible >= 3) await imp.req('POST', `/dossiers/${d.id}/actions/marquer_imprime`, {});
    if (cible >= 4) {
      const demain = new Date(Date.now() + 3600_000 * (i % 2 ? 3 : 26)).toISOString().slice(0, 16);
      await liv.req('POST', `/dossiers/${d.id}/actions/programmer_livraison`, { livraison: { date_prevue: demain, adresse: s.adr ?? 'Plateau, avenue Pompidou' } });
    }
    if (cible >= 5) {
      const montant = d.montant as number;
      const enc = s.pay === 'complet' || s.pay === 'a_valider' ? { montant, mode: 'wave', reference: `WV-${100200 + i}` } : null;
      await liv.req('POST', `/dossiers/${d.id}/actions/confirmer_livraison`, { encaissement: enc });
    }
    if (s.pay === 'acompte') await prep.req('POST', `/dossiers/${d.id}/paiements`, { montant: Math.round((d.montant as number) / 2), mode: 'especes', notes: 'Acompte à la commande' }).catch(() => {});
    if (s.pay === 'complet') {
      const p = await admin.req('GET', `/paiements?statut=a_valider`).catch(() => null);
      for (const it of p?.items ?? []) if (it.dossier_id === d.id) await admin.req('POST', `/paiements/${it.id}/valider`, {});
    }
    if (cible >= 6) await admin.req('POST', `/dossiers/${d.id}/actions/cloturer`, {});
  }
  console.log(`${DOSSIERS.length} dossiers de démonstration créés.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
