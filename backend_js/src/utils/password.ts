import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Handle both string and Buffer hash
  const hashBytes = typeof hash === 'string' && hash.startsWith('$2')
    ? hash
    : Buffer.from(hash).toString('utf-8');
  return bcrypt.compare(password, hashBytes);
}
