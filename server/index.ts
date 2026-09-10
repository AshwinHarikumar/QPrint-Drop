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

const app = express();
const httpServer = createHttpServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8 // 100 MB
});

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SIGNING_SECRET || 'dev-secret-key-change-me';

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
const printJobs = new Map<string, any>();

app.use(express.json());

// API Routes
app.post('/api/session', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    const payload = JSON.stringify({ sessionId, expiresAt });
    const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    const token = `${Buffer.from(payload).toString('base64')}.${hmac}`;

    sessions.set(sessionId, {
      sessionId,
      status: 'waiting',
      createdAt: Date.now(),
      expiresAt,
      desktopConnected: true,
      uploaderConnected: false,
      jobCount: 0
    });

    res.json({ sessionId, token, expiresAt });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/api/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid token' });
  }

  try {
    const [payloadB64, signature] = token.split('.');
    const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
    
    const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('hex');
    if (hmac !== signature) {
      return res.status(401).json({ error: 'Invalid token signature' });
    }

    const payload = JSON.parse(payloadStr);
    if (payload.sessionId !== sessionId || Date.now() > payload.expiresAt) {
      return res.status(401).json({ error: 'Token expired or invalid for this session' });
    }

    const sessionData = sessions.get(sessionId);
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ valid: true, session: sessionData });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
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
        io.to(`session:${sessionId}`).emit('sender:connected');
      } else if (role === 'receiver') {
        session.desktopConnected = true;
        io.to(`session:${sessionId}`).emit('receiver:connected');
      }
      sessions.set(sessionId, session);
    }
    
    socket.emit('session:joined', { sessionId, role });
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
