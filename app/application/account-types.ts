export interface AccountUser {
  id: string;
  name: string;
  account: string;
  role: 'admin' | 'user';
  isDefaultAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}
