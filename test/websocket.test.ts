/**
 * WebSocket connection test
 * Ishlatish: ts-node -r tsconfig-paths/register test/websocket.test.ts
 *
 * Oldin server ishlab turishi kerak: npm run dev
 * Token: POST http://localhost:4000/api/auth/login dan oling
 */

import { io, Socket } from 'socket.io-client'

const WS_URL = 'http://localhost:4000/ws'
const TOKEN = process.env.WS_TOKEN || '' // Token .env yoki argument orqali

if (!TOKEN) {
  console.error('❌  WS_TOKEN topilmadi. Ishlatish:')
  console.error('   WS_TOKEN=<jwt_token> ts-node -r tsconfig-paths/register test/websocket.test.ts')
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────
//  Yordamchi funksiyalar
// ─────────────────────────────────────────────────────────────

function createClient(label: string, token: string): Socket {
  return io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  })
}

function waitForEvent(socket: Socket, event: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: "${event}" eventi kelmadi`)), timeoutMs)
    socket.once(event, (data) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

function log(label: string, status: '✅' | '❌' | '📡', msg: string, data?: any) {
  const prefix = `[${label}] ${status}`
  console.log(prefix, msg)
  if (data) console.log('   ', JSON.stringify(data, null, 2))
}

// ─────────────────────────────────────────────────────────────
//  Testlar
// ─────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  Zahro Dental — WebSocket Connection Tests')
  console.log('═══════════════════════════════════════════\n')

  let passed = 0
  let failed = 0

  // ── Test 1: Muvaffaqiyatli ulanish ─────────────────────────
  console.log('── Test 1: Muvaffaqiyatli ulanish')
  const client1 = createClient('Client1', TOKEN)

  try {
    const data = await waitForEvent(client1, 'connected')
    log('Client1', '✅', `Ulandi. Role: ${data.role}, Rooms: ${data.rooms?.join(', ')}`, data)
    passed++
  } catch (e) {
    log('Client1', '❌', e.message)
    failed++
  }

  // ── Test 2: Noto'g'ri token bilan ulanish ──────────────────
  console.log('\n── Test 2: Noto\'g\'ri token bilan ulanish')
  const client2 = createClient('Client2', 'invalid_token_xyz')

  try {
    const data = await waitForEvent(client2, 'error', 3000)
    log('Client2', '✅', `Xato qaytarildi (kutilgan): ${data.message}`)
    passed++
  } catch {
    log('Client2', '❌', 'Noto\'g\'ri token rad etilmadi')
    failed++
  }

  // ── Test 3: Ping / Pong ─────────────────────────────────────
  console.log('\n── Test 3: Ping / Pong')
  try {
    client1.emit('ping')
    const pong = await waitForEvent(client1, 'pong')
    log('Client1', '✅', `Pong keldi: ${pong.time}`)
    passed++
  } catch (e) {
    log('Client1', '❌', e.message)
    failed++
  }

  // ── Test 4: Xonaga qo'shilish ──────────────────────────────
  console.log('\n── Test 4: Xonaga qo\'shilish (join:room)')
  try {
    client1.emit('join:room', { room: 'branch:test-branch-id' })
    const joined = await waitForEvent(client1, 'joined')
    log('Client1', '✅', `Xonaga qo'shildi: ${joined.room}`)
    passed++
  } catch (e) {
    log('Client1', '❌', e.message)
    failed++
  }

  // ── Test 5: Online foydalanuvchilar ────────────────────────
  console.log('\n── Test 5: Online foydalanuvchilar (get:online)')
  try {
    client1.emit('get:online')
    const onlineData = await waitForEvent(client1, 'online:list')
    log('Client1', '✅', `Online: ${onlineData.count} foydalanuvchi`, onlineData)
    passed++
  } catch (e) {
    log('Client1', '❌', e.message)
    failed++
  }

  // ── Test 6: Ikki client — bir xona ─────────────────────────
  console.log('\n── Test 6: Ikki client — bir xona orqali xabar')
  const client3 = createClient('Client3', TOKEN)

  try {
    await waitForEvent(client3, 'connected')
    log('Client3', '📡', 'Ulandi')

    // Ikkala clientni bir xonaga qo'shamiz
    const testRoom = 'branch:shared-room-test'
    client1.emit('join:room', { room: testRoom })
    client3.emit('join:room', { room: testRoom })

    await waitForEvent(client1, 'joined')
    await waitForEvent(client3, 'joined')

    log('Client3', '✅', 'Ikki client ham bir xonada')
    passed++
  } catch (e) {
    log('Client3', '❌', e.message)
    failed++
  }

  // ── Test 7: Xonadan chiqish ────────────────────────────────
  console.log('\n── Test 7: Xonadan chiqish (leave:room)')
  try {
    client1.emit('leave:room', { room: 'branch:test-branch-id' })
    const left = await waitForEvent(client1, 'left')
    log('Client1', '✅', `Xonadan chiqdi: ${left.room}`)
    passed++
  } catch (e) {
    log('Client1', '❌', e.message)
    failed++
  }

  // ─── Yakuniy natija ────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════')
  console.log(`  Natija: ${passed} ✅ o\'tdi  |  ${failed} ❌ xato`)
  console.log('═══════════════════════════════════════════\n')

  client1.disconnect()
  client2.disconnect()
  client3.disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch((err) => {
  console.error('Test ishga tushmadi:', err)
  process.exit(1)
})
