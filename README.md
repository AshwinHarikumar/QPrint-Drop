# QPrint Drop

QPrint Drop is a QR-based file transfer and printing workspace that lets a desktop receiver generate a session QR code, then lets a mobile sender upload files into the live queue for printing or download.

## What it does

- Generates a temporary QR session on the receive screen.
- Lets a sender join that session from a mobile browser using the session token.
- Uploads files with live progress updates and queue state.
- Applies print options such as copies, orientation, color mode, paper size, and duplex.
- Supports real-time updates through Socket.IO so the receiver and sender stay in sync.

## Tech Stack

- React 19
- Vite
- TypeScript
- Express
- Socket.IO
- Tailwind CSS
- `react-qr-code`
- `lucide-react`

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- A `GEMINI_API_KEY` in `.env.local` if your local workflow needs Gemini access

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

The app starts the server entrypoint from `server/index.ts` and serves the React UI through Vite.

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run start
```

## Deploying to Server (20.65.116.196)

### Connecting your Domain with Cloudflare A Record

1. In your **Cloudflare Dashboard**, navigate to your domain -> **DNS** -> **Records**.
2. Add or edit an **A Record**:
   - **Type**: `A`
   - **Name**: `@` (or subdomain, e.g. `print`)
   - **IPv4 address**: `20.65.116.196`
   - **Proxy status**: **Proxied** (Orange cloud icon enabled)
3. In Cloudflare **SSL/TLS**:
   - Set encryption mode to **Flexible** (or **Full** if your server has SSL/TLS certificates).
4. In Cloudflare **Network**:
   - Ensure **WebSockets** is toggled **ON** (default is enabled).

### Option 1: Docker Compose (Binds Port 80 & 3000)

```bash
docker compose up -d --build
```
This automatically routes standard incoming HTTP traffic from Cloudflare on port 80 directly to the app!

### Option 2: PM2 / Node on Linux Server

```bash
# 1. Install dependencies & build
npm ci
npm run build

# 2. Run with PM2 daemon
sudo npm install -g pm2
pm2 start dist/server.cjs --name qprint-drop
pm2 save
pm2 startup
```

### Option 3: Systemd Service
Copy `qprint.service` to `/etc/systemd/system/qprint.service`:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now qprint
```

### Optional: Nginx Reverse Proxy (Port 80 -> 3000)
To serve directly on port 80 without `:3000` in the URL, use the provided `nginx.conf`:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/qprint-drop
sudo ln -s /etc/nginx/sites-available/qprint-drop /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Environment Variables

The project includes `.env` preconfigured for `http://20.65.116.196:3000`:

```bash
PORT=3000
APP_URL=http://20.65.116.196:3000
SESSION_SIGNING_SECRET=your_signing_secret_here
```

## Available Scripts

- `npm run dev` - start the development server
- `npm run build` - create the production bundle
- `npm run start` - run the built server bundle
- `npm run preview` - preview the Vite client build
- `npm run lint` - type-check the workspace

## Project Structure

- `server/` - Express and socket handling
- `src/pages/Receive.tsx` - QR session generator and print queue receiver
- `src/pages/Send.tsx` - file upload and sender experience
- `shared/types/` - shared TypeScript types
- `public/` - static assets

## Notes

- The root route redirects to `/receive`.
- Sender access requires a valid session token in the URL.
- The app is designed for local network transfers between a desktop and mobile device.

## License

No license has been declared in this repository yet.
