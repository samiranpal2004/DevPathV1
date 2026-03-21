import crypto from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O,0,I,1

export function generateRoomCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes)
    .map((byte) => CHARSET[byte % CHARSET.length])
    .join('');
}