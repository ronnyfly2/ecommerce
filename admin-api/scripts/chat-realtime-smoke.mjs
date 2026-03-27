import { io } from '/Users/ronny/Developer/ecommerce/admin-panel/node_modules/socket.io-client/build/esm-debug/index.js'

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api'
const WS_BASE = API_BASE.replace(/\/api\/?$/, '')
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin2026!'

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options)
  const body = await res.json()
  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(body)}`)
  }
  return body
}

async function login(email) {
  const body = await jsonFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })

  return {
    token: body.data.accessToken,
    user: body.data.user,
  }
}

async function main() {
  const usersResponse = await login('admin@local.dev')
  const adminA = usersResponse.user
  const tokenA = usersResponse.token

  const usersList = await jsonFetch(`${API_BASE}/users?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  })

  const secondAdmin = (usersList.data.items || []).find(
    (user) => user.email !== adminA.email && ['ADMIN', 'SUPER_ADMIN', 'BOSS', 'MARKETING', 'SALES'].includes(user.role),
  )

  if (!secondAdmin) {
    throw new Error('No se encontro segundo admin para prueba realtime')
  }

  const loginB = await login(secondAdmin.email)
  const tokenB = loginB.token
  const adminB = loginB.user

  const groupResponse = await jsonFetch(`${API_BASE}/chat/groups`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Realtime Smoke ${Date.now()}`,
      memberIds: [adminB.id],
    }),
  })

  const groupId = groupResponse.data.id
  if (!groupId) {
    throw new Error(`No groupId en respuesta: ${JSON.stringify(groupResponse)}`)
  }

  const socketA = io(`${WS_BASE}/chat`, { auth: { token: tokenA }, transports: ['websocket'] })
  const socketB = io(`${WS_BASE}/chat`, { auth: { token: tokenB }, transports: ['websocket'] })

  const waitForConnect = (socket, label) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout conectando ${label}`)), 8000)
    socket.once('connect', () => {
      clearTimeout(timeout)
      resolve()
    })
    socket.once('connect_error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Connect error ${label}: ${err.message}`))
    })
  })

  await Promise.all([waitForConnect(socketA, 'A'), waitForConnect(socketB, 'B')])

  const groupMessagePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando chat.group.message en B')), 10000)
    socketB.once('chat.group.message', (payload) => {
      clearTimeout(timeout)
      resolve(payload)
    })
  })

  const readReceiptPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando chat.group.read en A')), 10000)
    socketA.once('chat.group.read', (payload) => {
      clearTimeout(timeout)
      resolve(payload)
    })
  })

  const messageText = `realtime smoke ${Date.now()}`
  const sendResponse = await jsonFetch(`${API_BASE}/chat/groups/${groupId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: messageText }),
  })

  const receivedMessage = await groupMessagePromise
  await jsonFetch(`${API_BASE}/chat/groups/${groupId}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenB}` },
  })
  const readReceipt = await readReceiptPromise

  socketA.disconnect()
  socketB.disconnect()

  console.log(JSON.stringify({
    groupId,
    sentMessageId: sendResponse.data.id,
    receivedMessageId: receivedMessage.id,
    receivedMessageContent: receivedMessage.content,
    readReceipt,
    readerIdExpected: adminB.id,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
