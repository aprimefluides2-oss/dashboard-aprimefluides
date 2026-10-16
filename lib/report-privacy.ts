import { anonymizePublicText } from './anonymize-public'
export function streetOnly(address: string): string {
  const match = address.match(/(?:rue|avenue|boulevard|impasse|allée|allee|chemin|place|quai|route|passage|square)\s+[^,;\n]+/i)
  return match ? match[0].replace(/\s+\d{5}\b.*$/, '').replace(/\s+(?:bâtiment|batiment|appartement|étage|etage|digicode|code d.accès)\b.*$/i, '').trim() : ''
}
export function privateReport<T>(value: T, clientName = ''): T {
  const name = clientName.trim().replace(/^(?:M\.|Mr|Mme|Monsieur|Madame)\s+/i, '')
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  function walk(node: unknown, key = ''): unknown {
    if (/^(?:client_?nom|client_?email|client_?telephone|signature_client)$/i.test(key)) return ''
    if (typeof node === 'string') {
      if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(node)) return node
      if (/^(?:url|src|href|@id|@context)$/i.test(key)) return node
      if (/^(?:adresse|client_adresse|adresse_chantier)$/i.test(key)) return streetOnly(node)
      let text = node.replace(/\b\d{1,4}(?:\s*(?:bis|ter))?\s*,?\s*((?:rue|avenue|boulevard|impasse|allée|allee|chemin|place|quai|route|passage|square)\b)/gi, '$1')
      if (name.length >= 2) text = text.replace(new RegExp(`(?<![A-Za-zÀ-ÿ])${escaped}(?![A-Za-zÀ-ÿ])`, 'gi'), 'le client')
      text = text.replace(/\bau\s+(rue|avenue|impasse|allée|allee)\b/gi, 'dans la $1')
      return anonymizePublicText(text)
    }
    if (Array.isArray(node)) return node.map(v => walk(v))
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k,v]) => [k, walk(v,k)]))
    return node
  }
  return walk(value) as T
}
