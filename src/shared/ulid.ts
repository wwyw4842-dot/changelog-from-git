// 客户端 ULID：写操作幂等键（eventId）。时间前缀 48bit + 随机 80bit，Crockford Base32。
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function ulid(): string {
  let ts = Date.now()
  const time = new Array<string>(10)
  for (let i = 9; i >= 0; i--) {
    time[i] = ALPHABET[ts % 32]
    ts = Math.floor(ts / 32)
  }
  const rand = new Uint8Array(16)
  crypto.getRandomValues(rand)
  let out = time.join('')
  for (let i = 0; i < 16; i++) out += ALPHABET[rand[i] % 32]
  return out
}
