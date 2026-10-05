// Remplace tus-js-client dans la démonstration (alias de vite.demo.config.ts) : la progression
// est simulée, puis le fichier est ajouté au dossier par l'API simulée (POST /api/uploads).
// Le contenu reste dans la page (aperçu réel du fichier choisi) et n'est envoyé nulle part.

import { enregistrerContenu } from './fichiers';

interface Reponse {
  getStatus(): number;
  getBody(): string;
}

export class DetailedError extends Error {
  constructor(
    message: string,
    public originalResponse: Reponse | null = null,
  ) {
    super(message);
  }
}

interface Options {
  metadata?: Record<string, string>;
  onProgress?: (octets: number, total: number) => void;
  onError?: (err: Error) => void;
  onSuccess?: () => void;
  [cle: string]: unknown;
}

export class Upload {
  private minuterie: ReturnType<typeof setInterval> | null = null;
  private octets = 0;
  private fini = false;

  constructor(
    public file: File,
    public options: Options,
  ) {}

  findPreviousUploads(): Promise<{ metadata?: Record<string, string> }[]> {
    return Promise.resolve([]);
  }

  resumeFromPreviousUpload(_precedent: unknown) {}

  start() {
    if (this.minuterie || this.fini) return;
    const total = this.file.size;
    // Entre 1 et 4 secondes selon la taille : de quoi voir la progression.
    const duree = Math.min(4000, Math.max(1000, total / 2000));
    const pas = Math.max(1, Math.ceil(total / (duree / 100)));
    this.minuterie = setInterval(() => {
      this.octets = Math.min(total, this.octets + pas);
      this.options.onProgress?.(this.octets, total);
      if (this.octets >= total) {
        this.arreter();
        void this.terminer();
      }
    }, 100);
  }

  private arreter() {
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = null;
  }

  private async terminer() {
    const m = this.options.metadata ?? {};
    const r = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossierId: Number(m.dossierId), filename: m.filename ?? this.file.name, filetype: m.filetype ?? this.file.type, taille: this.file.size }),
    });
    if (r.ok) {
      this.fini = true;
      const id = Number(r.headers.get('X-Fichier-Id'));
      if (id) enregistrerContenu(id, this.file);
      this.options.onSuccess?.();
      return;
    }
    const corps = await r.text();
    this.octets = 0;
    this.options.onError?.(new DetailedError(corps, { getStatus: () => r.status, getBody: () => corps }));
  }

  abort(_terminer?: boolean): Promise<void> {
    this.arreter();
    return Promise.resolve();
  }
}

export default { Upload, DetailedError };
