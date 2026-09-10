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

## Environment Variables

Create a `.env.local` file and define the values your deployment needs. The current project notes expect:

```bash
GEMINI_API_KEY=your_api_key_here
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
