# WhatsApp — Evolution API (self-hosted, local)

Single-instance WhatsApp gateway. Runs locally on Mohammed's machine.
Cloudflare Tunnel exposes it to Antagna (Vercel).

## Step 1 — Generate secrets

```bash
cd infra/whatsapp
cp .env.example .env

# Generate two random keys (Linux/Mac):
openssl rand -hex 32   # → paste as EVOLUTION_API_KEY
openssl rand -hex 32   # → paste as EVOLUTION_DB_PASSWORD
```

## Step 2 — Bring up Evolution API

```bash
docker compose --env-file .env up -d
docker compose --env-file .env logs -f evolution
```

Wait until logs show `🚀 Evolution API ready, listening on port: 8080`.

Health check:
```bash
curl -s -H "apikey: $EVOLUTION_API_KEY" http://localhost:8080/instance/fetchInstances
```

## Step 3 — Expose via Cloudflare Tunnel

Antagna runs on Vercel. Vercel can't call `localhost:8080`. We use
Cloudflare Tunnel to give Evolution a stable public URL.

```bash
# Install once:
brew install cloudflare/cloudflare/cloudflared    # macOS
# OR: sudo apt install cloudflared                # Linux

# Authenticate with your Cloudflare account (opens browser):
cloudflared tunnel login

# Create the tunnel:
cloudflared tunnel create antagna-whatsapp

# Map your domain (e.g. whatsapp.antagna.me):
cloudflared tunnel route dns antagna-whatsapp whatsapp.antagna.me
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: antagna-whatsapp
credentials-file: /home/mohammed/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: whatsapp.antagna.me
    service: http://localhost:8080
  - service: http_status:404
```

Run it (foreground for now, install as service later):

```bash
cloudflared tunnel run antagna-whatsapp
```

Test from anywhere on the internet:
```bash
curl https://whatsapp.antagna.me/    # should hit Evolution
```

## Step 4 — Wire Antagna's env vars

In Vercel (production):

```bash
cd /home/mohammed/antagna

vercel env add WHATSAPP_API_URL production
# → https://whatsapp.antagna.me

vercel env add WHATSAPP_API_KEY production
# → paste the EVOLUTION_API_KEY from infra/whatsapp/.env

vercel env add WHATSAPP_OUR_E164 production
# → the phone number you'll pair, e.g. +966501234567

vercel env add WHATSAPP_INSTANCE_NAME production
# → antagna   (optional, defaults to "antagna")
```

Then redeploy:
```bash
vercel deploy --prod --yes
```

## Step 5 — Pair the phone

1. Go to <https://antagna-v2.vercel.app/admin/integrations/whatsapp>
2. Click **اعمل Pair** — a QR appears
3. On the phone: WhatsApp → Settings → Linked Devices → Link a Device
4. Scan the QR
5. The state pill flips from `في انتظار QR` → `✓ متصل`

## Step 6 — Test send

The admin page has a test-send form once connected. Or curl:

```bash
curl -X POST -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"number":"966501234567","text":"hi from Antagna"}' \
  http://localhost:8080/message/sendText/antagna
```

## Step 7 — Receive a test message

Have someone send a WhatsApp message to the paired number. Within 1-2
seconds it should appear at:
<https://antagna-v2.vercel.app/admin/integrations/whatsapp>
(scroll to "آخر 10 رسائل")

If it doesn't:
- `docker compose logs evolution` — look for "Webhook delivery" errors
- Check `WEBHOOK_GLOBAL_URL` in `.env` is correct
- Check Vercel function logs for `/api/integrations/whatsapp/webhook`

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| QR never loads | Evolution not running — `docker compose ps` |
| `apikey` errors from /pair | `WHATSAPP_API_KEY` in Vercel ≠ `EVOLUTION_API_KEY` in compose |
| State stays `connecting` after QR scan | Phone needs to be online and reachable |
| `Send` returns 502 from Antagna | Cloudflare Tunnel down — `cloudflared tunnel list` |
| Messages received but not in DB | Vercel function failed — check function logs |
| WhatsApp banned the number | Too many messages, or sent before the account was warmed up. Get a fresh number. |

## Resetting

To kill the WhatsApp session and start over (new QR):

```bash
# Soft — keeps DB
curl -X DELETE -H "apikey: $EVOLUTION_API_KEY" http://localhost:8080/instance/logout/antagna

# Hard — nukes Evolution's local state (instances + DB)
docker compose --env-file .env down -v
docker compose --env-file .env up -d
```
