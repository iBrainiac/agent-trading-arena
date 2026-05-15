import crypto from 'crypto';

export function hmacSign(secretKey: string, prehash: string): string {
  return crypto.createHmac('sha256', secretKey).update(prehash).digest('base64');
}

export function okxWsAuthArgs(apiKey: string, secretKey: string, passphrase: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const prehash = `${ts}GET/users/self/verify`;
  const sign = hmacSign(secretKey, prehash);
  return { op: 'login', args: [{ apiKey, passphrase, timestamp: ts, sign }] };
}
