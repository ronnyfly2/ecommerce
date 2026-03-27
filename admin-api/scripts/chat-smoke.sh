#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.dev}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin2026!}"
UPLOAD_FILE="${UPLOAD_FILE:-/tmp/chat-smoke-upload.txt}"

extract_json() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d); process.stdout.write(process.argv[1].split(".").reduce((acc,key)=>acc?.[key], j) ?? "")})' "$1"
}

echo "[1/8] Login admin"
LOGIN=$(curl -sS -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
TOKEN=$(printf '%s' "$LOGIN" | extract_json data.accessToken)
ADMIN_ID=$(printf '%s' "$LOGIN" | extract_json data.user.id)
if [[ -z "$TOKEN" || -z "$ADMIN_ID" ]]; then
  echo "Login failed"
  echo "$LOGIN"
  exit 1
fi

printf 'chat smoke %s\n' "$(date +%s)" > "$UPLOAD_FILE"

echo "[2/8] Buscar usuarios para conversación y grupo"
USERS=$(curl -sS -G "$API_BASE/users" -H "Authorization: Bearer $TOKEN" --data-urlencode 'page=1' --data-urlencode 'limit=10')
TARGET_ID=$(printf '%s' "$USERS" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d); const items=j?.data?.items||[]; const me=process.env.ADMIN_ID; const target=items.find(u=>u.id!==me); process.stdout.write(target?.id||"")})')
GROUP_MEMBER_IDS=$(printf '%s' "$USERS" | ADMIN_ID="$ADMIN_ID" node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d); const items=j?.data?.items||[]; const me=process.env.ADMIN_ID; const picked=items.filter(u=>u.id!==me && ["SUPER_ADMIN","ADMIN"].includes(u.role)).slice(0,2).map(u=>u.id); process.stdout.write(JSON.stringify(picked))})')
if [[ -z "$TARGET_ID" ]]; then
  echo "No target user found"
  exit 1
fi

if [[ "$GROUP_MEMBER_IDS" == "[]" ]]; then
  echo "No backoffice users found for group creation"
  exit 1
fi

echo "[3/8] Enviar mensaje directo"
DIRECT_TEXT="smoke direct $(date +%s)"
DIRECT_SEND=$(curl -sS -X POST "$API_BASE/chat/$TARGET_ID/messages" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"content\":\"$DIRECT_TEXT\"}")
DIRECT_ID=$(printf '%s' "$DIRECT_SEND" | extract_json data.id)
DIRECT_CONTENT=$(printf '%s' "$DIRECT_SEND" | extract_json data.content)
[[ "$DIRECT_CONTENT" == "$DIRECT_TEXT" ]]

echo "[4/8] Subir adjunto directo"
DIRECT_ATTACHMENT=$(curl -sS -X POST "$API_BASE/chat/$TARGET_ID/attachments" -H "Authorization: Bearer $TOKEN" -F "file=@$UPLOAD_FILE")
DIRECT_ATTACHMENT_ID=$(printf '%s' "$DIRECT_ATTACHMENT" | extract_json data.id)
DIRECT_ATTACHMENT_TYPE=$(printf '%s' "$DIRECT_ATTACHMENT" | extract_json data.messageType)
DIRECT_ATTACHMENT_URL=$(printf '%s' "$DIRECT_ATTACHMENT" | extract_json data.attachmentUrl)
[[ -n "$DIRECT_ATTACHMENT_ID" && -n "$DIRECT_ATTACHMENT_URL" && -n "$DIRECT_ATTACHMENT_TYPE" ]]

echo "[5/8] Crear grupo"
GROUP_NAME="Smoke Group $(date +%s)"
GROUP_CREATE=$(printf '%s' "$GROUP_MEMBER_IDS" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const ids=JSON.parse(d); const payload={name:process.argv[1],memberIds:ids}; process.stdout.write(JSON.stringify(payload))})' "$GROUP_NAME" | curl -sS -X POST "$API_BASE/chat/groups" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data-binary @-)
GROUP_ID=$(printf '%s' "$GROUP_CREATE" | extract_json data.id)
[[ -n "$GROUP_ID" ]]

echo "[6/8] Enviar mensaje a grupo"
GROUP_TEXT="smoke group $(date +%s)"
GROUP_SEND=$(curl -sS -X POST "$API_BASE/chat/groups/$GROUP_ID/messages" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"content\":\"$GROUP_TEXT\"}")
GROUP_MSG_ID=$(printf '%s' "$GROUP_SEND" | extract_json data.id)
GROUP_MSG_CONTENT=$(printf '%s' "$GROUP_SEND" | extract_json data.content)
[[ "$GROUP_MSG_CONTENT" == "$GROUP_TEXT" ]]

echo "[7/8] Subir adjunto a grupo"
GROUP_ATTACHMENT=$(curl -sS -X POST "$API_BASE/chat/groups/$GROUP_ID/attachments" -H "Authorization: Bearer $TOKEN" -F "file=@$UPLOAD_FILE")
GROUP_ATTACHMENT_ID=$(printf '%s' "$GROUP_ATTACHMENT" | extract_json data.id)
GROUP_ATTACHMENT_URL=$(printf '%s' "$GROUP_ATTACHMENT" | extract_json data.attachmentUrl)
[[ -n "$GROUP_ATTACHMENT_ID" && -n "$GROUP_ATTACHMENT_URL" ]]

echo "[8/8] Marcar grupo y directo como leído + verificar listados"
curl -sS -X PATCH "$API_BASE/chat/$TARGET_ID/read" -H "Authorization: Bearer $TOKEN" >/dev/null
curl -sS -X PATCH "$API_BASE/chat/groups/$GROUP_ID/read" -H "Authorization: Bearer $TOKEN" >/dev/null
DIRECT_LIST=$(curl -sS -G "$API_BASE/chat/$TARGET_ID/messages" -H "Authorization: Bearer $TOKEN" --data-urlencode 'page=1' --data-urlencode 'limit=20')
GROUP_LIST=$(curl -sS -G "$API_BASE/chat/groups/$GROUP_ID/messages" -H "Authorization: Bearer $TOKEN" --data-urlencode 'page=1' --data-urlencode 'limit=20')
DIRECT_FOUND=$(printf '%s' "$DIRECT_LIST" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d); const ok=(j?.data?.items||[]).some(m=>m.id===process.argv[1]); process.stdout.write(ok?"yes":"no")})' "$DIRECT_ID")
GROUP_FOUND=$(printf '%s' "$GROUP_LIST" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d); const ok=(j?.data?.items||[]).some(m=>m.id===process.argv[1]); process.stdout.write(ok?"yes":"no")})' "$GROUP_MSG_ID")
[[ "$DIRECT_FOUND" == "yes" && "$GROUP_FOUND" == "yes" ]]

echo "OK"
echo "direct_message_id=$DIRECT_ID"
echo "direct_attachment_type=$DIRECT_ATTACHMENT_TYPE"
echo "group_id=$GROUP_ID"
echo "group_message_id=$GROUP_MSG_ID"
