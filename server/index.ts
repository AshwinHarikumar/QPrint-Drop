import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.set('trust proxy', true);
const httpServer = createHttpServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8 // 100 MB
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SESSION_SECRET = process.env.SESSION_SIGNING_SECRET || 'dev-secret-key-change-me';
const APP_URL = process.env.APP_URL || '';

const UPLOAD_DIR = path.join(os.tmpdir(), 'qr-print-drop-uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const jobId = req.params.jobId || uuidv4();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${jobId}-${safeName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// Memory stores
const sessions = new Map<string, any>();
const sessionsByCode = new Map<string, string>(); // code -> sessionId
const sessionsByName = new Map<string, string>(); // lowercase name -> sessionId
const printJobs = new Map<string, any>();

function createSessionToken(sessionId: string, expiresAt: number): string {
  const payload = JSON.stringify({ sessionId, expiresAt });
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64')}.${hmac}`;
}

function verifySessionToken(sessionId: string, token: string): boolean {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return false;
    const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
    const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('hex');
    if (hmac !== signature) return false;
    const payload = JSON.parse(payloadStr);
    return payload.sessionId === sessionId && Date.now() <= payload.expiresAt;
  } catch {
    return false;
  }
}

function generateSessionCode(): string {
  let code = '';
  let attempts = 0;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
  } while (sessionsByCode.has(code) && attempts < 100);
  return code;
}

function sanitizeSessionName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 32);
}

function generateDefaultSessionName(): string {
  const adjectives = ['swift', 'crisp', 'bright', 'quick', 'rapid', 'drop', 'cloud', 'nexus'];
  const nouns = ['room', 'desk', 'queue', 'hub', 'print', 'dock', 'zone', 'share'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}-${noun}-${num}`;
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    sessionsByCode.delete(session.code);
    sessionsByName.delete(session.name.toLowerCase());
    sessions.delete(sessionId);
  }
  for (const [jobId, job] of printJobs.entries()) {
    if (job.sessionId === sessionId) {
      if (job.localPath && fs.existsSync(job.localPath)) {
        try { fs.unlinkSync(job.localPath); } catch {}
      }
      printJobs.delete(jobId);
    }
  }
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      cleanupSession(sessionId);
    }
  }
}, 5 * 60 * 1000);

app.use(express.json());

// API Routes
app.get('/api/config', (req, res) => {
  // If APP_URL is explicitly set, use that; otherwise detect from request headers
  // Works with Cloudflare proxy (x-forwarded-proto/host), custom domains, or direct IP
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '20.65.116.196:3000';
  const autoUrl = `${protocol}://${host}`;
  res.json({ appUrl: APP_URL || autoUrl });
});

app.post('/api/session', async (req, res) => {
  try {
    const requestedName = typeof req.body?.name === 'string' ? sanitizeSessionName(req.body.name) : '';
    const durationMinutes = Math.min(Math.max(Number(req.body?.durationMinutes) || 1440, 5), 10080); // 5 mins to 7 days, default 24 hours

    // If an existing active session matches the requested name, allow reconnecting to it
    if (requestedName) {
      const existingSessionId = sessionsByName.get(requestedName.toLowerCase());
      if (existingSessionId) {
        const existing = sessions.get(existingSessionId);
        if (existing && Date.now() < existing.expiresAt) {
          return res.json({
            sessionId: existing.sessionId,
            code: existing.code,
            name: existing.name,
            token: existing.token,
            expiresAt: existing.expiresAt,
            durationMinutes: existing.durationMinutes,
            rejoined: true
          });
        } else {
          sessionsByName.delete(requestedName.toLowerCase());
          if (existing) sessionsByCode.delete(existing.code);
        }
      }
    }

    const sessionId = uuidv4();
    const code = generateSessionCode();
    const name = requestedName || generateDefaultSessionName();
    const expiresAt = Date.now() + durationMinutes * 60 * 1000;
    const token = createSessionToken(sessionId, expiresAt);

    const sessionData = {
      sessionId,
      code,
      name,
      token,
      status: 'waiting',
      createdAt: Date.now(),
      expiresAt,
      durationMinutes,
      desktopConnected: true,
      uploaderConnected: false,
      jobCount: 0
    };

    sessions.set(sessionId, sessionData);
    sessionsByCode.set(code, sessionId);
    sessionsByName.set(name.toLowerCase(), sessionId);

    res.json({
      sessionId,
      code,
      name,
      token,
      expiresAt,
      durationMinutes
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Find session by code, name, or sessionId
app.get('/api/session/find', async (req, res) => {
  try {
    const query = (req.query.query as string || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing session code or name' });
    }

    // Try matching normalized numeric code (strip spaces, dashes)
    const normalizedCode = query.replace(/[\s-]+/g, '');
    let sessionId = sessionsByCode.get(normalizedCode);

    // Try matching case-insensitive name
    if (!sessionId) {
      sessionId = sessionsByName.get(query.toLowerCase());
    }

    // Try matching exact sessionId
    if (!sessionId && sessions.has(query)) {
      sessionId = query;
    }

    if (!sessionId) {
      return res.status(404).json({ error: 'Session not found. Please check the code or name.' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (Date.now() > session.expiresAt) {
      cleanupSession(sessionId);
      return res.status(410).json({ error: 'Session has expired' });
    }

    const token = session.token || createSessionToken(sessionId, session.expiresAt);

    res.json({
      valid: true,
      session,
      token
    });
  } catch (error) {
    console.error('Session find error:', error);
    res.status(500).json({ error: 'Server error searching for session' });
  }
});

app.get('/api/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { token } = req.query;

  const sessionData = sessions.get(sessionId);
  if (!sessionData) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (Date.now() > sessionData.expiresAt) {
    cleanupSession(sessionId);
    return res.status(410).json({ error: 'Session expired' });
  }

  if (token && typeof token === 'string') {
    const isValid = verifySessionToken(sessionId, token);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired token signature' });
    }
  }

  res.json({ valid: true, session: sessionData, token: sessionData.token });
});

app.get('/api/session/:sessionId/jobs', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const jobs = Array.from(printJobs.values())
    .filter(job => job.sessionId === sessionId && job.status !== 'deleted')
    .sort((a, b) => b.createdAt - a.createdAt);

  res.json({ jobs });
});

app.post('/api/jobs', async (req, res) => {
  try {
    const { sessionId, originalFilename, mimeType, fileSize, printSettings } = req.body;
    
    const jobId = uuidv4();
    const storedFilename = `${jobId}-${originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    const jobData = {
      id: jobId,
      sessionId,
      originalFilename,
      storedFilename,
      mimeType,
      fileSize,
      status: 'uploading',
      printSettings: printSettings || {
        copies: 1,
        orientation: 'auto',
        colorMode: 'color',
        paperSize: 'A4',
        duplex: 'off'
      },
      createdAt: Date.now()
    };

    printJobs.set(jobId, jobData);
    
    io.to(`session:${sessionId}`).emit('job:created', jobData);

    res.json(jobData);
  } catch (error) {
    console.error('Job creation error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

app.post('/api/jobs/:jobId/upload', upload.single('file'), (req, res) => {
  try {
    const { jobId } = req.params;
    const jobData = printJobs.get(jobId);
    
    if (!jobData) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    jobData.status = 'uploaded';
    jobData.localPath = req.file.path;
    printJobs.set(jobId, jobData);

    io.to(`session:${jobData.sessionId}`).emit('job:ready', { 
      jobId, 
      originalFilename: jobData.originalFilename, 
      status: 'uploaded',
      url: `/api/download/${jobId}` 
    });
    
    res.json({ success: true, job: jobData });
  } catch (error) {
    console.error('Upload complete error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/view/:jobId', (req, res) => {
  const { jobId } = req.params;
  const jobData = printJobs.get(jobId);

  if (!jobData || !jobData.localPath || !fs.existsSync(jobData.localPath)) {
    return res.status(404).send('File not found');
  }

  res.setHeader('Content-Type', jobData.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(jobData.originalFilename)}"`);
  res.sendFile(path.resolve(jobData.localPath));
});

app.get('/api/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  const jobData = printJobs.get(jobId);
  
  if (!jobData || !jobData.localPath) {
    return res.status(404).send('File not found');
  }

  res.download(jobData.localPath, jobData.originalFilename);
});

app.delete('/api/jobs/:jobId', async (req, res) => {
  try {
     const { jobId } = req.params;
     const { sessionId } = req.body;
     const jobData = printJobs.get(jobId);
     
     if (jobData) {
        jobData.status = 'deleted';
        printJobs.set(jobId, jobData);
        if (jobData.localPath && fs.existsSync(jobData.localPath)) {
          fs.unlinkSync(jobData.localPath);
        }
        const sessionToNotify = sessionId || jobData.sessionId;
        io.to(`session:${sessionToNotify}`).emit('job:deleted', { jobId });
     }
     res.json({ success: true });
  } catch(error) {
     res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('session:join', async (data) => {
    const { sessionId, role } = data;
    socket.join(`session:${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (session) {
      if (role === 'sender') {
        session.uploaderConnected = true;
        io.to(`session:${sessionId}`).emit('sender:connected', { sessionId });
      } else if (role === 'receiver') {
        session.desktopConnected = true;
        io.to(`session:${sessionId}`).emit('receiver:connected', { sessionId });
      }
      sessions.set(sessionId, session);
    }
    
    socket.emit('session:joined', { sessionId, role, session });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
