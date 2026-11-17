export function generatePbId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  let id = ''
  for (let i = 0; i < 15; i++) id += chars[bytes[i] % 36]
  return id
}