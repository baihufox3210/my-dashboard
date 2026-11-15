// Short share links: /b/<8 characters of the article id><3 random characters>, /p/… for
// projects. The random tail makes every copied link new, so chat apps fetch a fresh
// preview instead of reusing one cached for an older link.
export type ShareKind = 'b' | 'p'

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function shortKey(id: string) {
  return id.replace(/-/g, '').slice(0, 8).toLowerCase()
}

export function shareUrl(kind: ShareKind, id: string) {
  const tail = Array.from(crypto.getRandomValues(new Uint8Array(3)), (value) => alphabet[value % alphabet.length]).join('')
  return `${window.location.origin}/${kind}/${shortKey(id)}${tail}`
}

export function keyFromCode(code: string) {
  return /^[0-9a-f]{8}[0-9a-z]{0,8}$/i.test(code) ? code.slice(0, 8).toLowerCase() : null
}
