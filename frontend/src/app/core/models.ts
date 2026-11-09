export type Role = 'SPORTIF' | 'GERANT' | 'ADMIN';

/** Correspond à UserResponse du microservice identity-user-service. */
export interface UserResponse {
  id: number;
  email: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  roles: Role[];
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  role?: 'SPORTIF' | 'GERANT';
}

export type FieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea';

export interface CrudField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  /** Masqué dans le tableau (affiché seulement dans le formulaire). */
  formOnly?: boolean;
  /** Pré-rempli avec l'id de l'utilisateur connecté. */
  currentUserId?: boolean;
  default?: unknown;
}

export interface CrudConfig {
  title: string;
  subtitle?: string;
  endpoint: string;
  fields: CrudField[];
  /** Rôles autorisés à créer / modifier / supprimer. Vide = lecture seule. */
  writeRoles: Role[];
  itemLabel: string;
}
