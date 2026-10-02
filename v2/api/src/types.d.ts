import type { Role } from '@evocom/shared';

export interface AuthUser {
  id: number;
  nom: string;
  email: string;
  role: Role;
  telephone: string | null;
  doit_changer_mdp: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
