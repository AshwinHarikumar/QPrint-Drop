import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router';
import QRCode from 'react-qr-code';
import { io, Socket } from 'socket.io-client';
import { PrintJob, TransferSession } from '../../shared/types';
import {
  FileText,
  Image as ImageIcon,
  Trash2,
  Printer,
  Download,
  QrCode,
  Phone,
  Loader2,
  ArrowUp,
  CheckCircle2,
  Cloud,
  Database,
  Shield,
  Wifi,
  Server,
  User,
  Copy,
  Check,
  ExternalLink,
  Plus,
  LogIn,
  Clock,
  Hash,
  Sparkles,
  RefreshCw,
  Share2,
  X,
  Eye
} from 'lucide-react';
import Seo from '../components/Seo';

export default function Receive() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [accessQuery, setAccessQuery] = useState('');
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  const [newSessionName, setNewSessionName] = useState('');
  const [newDuration, setNewDuration] = useState('1440'); // minutes
  const [createLoading, setCreateLoading] = useState(false);
  const [appUrl, setAppUrl] = useState<string>('');

  const socketRef = useRef<Socket | null>(null);

  // Load server config (e.g. public IP / APP_URL)
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d?.appUrl) setAppUrl(d.appUrl.replace(/\/+$/, ''));
      })
      .catch(() => {});
  }, []);

  // Fetch or create initial session
  const initSession = async () => {
    const urlCode = searchParams.get('code');
    const urlName = searchParams.get('name');
    const query = urlCode || urlName;

    setLoading(true);
    try {
      if (query) {
        // Try finding existing session
        const res = await fetch(`/api/session/find?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          loadSessionData(data.session, data.token);
          setLoading(false);
          return;
        }
      }

      // Default: create a new session
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 1440 })
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setToken(data.token);
      setSessionName(data.name);
      setSessionCode(data.code);
      setExpiresAt(data.expiresAt);
      fetchJobs(data.sessionId);
    } catch (e) {
      console.error('Failed to initialize session:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionData = (session: TransferSession, sessionToken: string) => {
    setSessionId(session.sessionId);
    setToken(sessionToken);
    setSessionName(session.name);
    setSessionCode(session.code);
    setExpiresAt(session.expiresAt);
    fetchJobs(session.sessionId);
  };

  const fetchJobs = async (id: string) => {
    try {
      const res = await fetch(`/api/session/${id}/jobs`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  // Expiration countdown
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft('Expired');
        clearInterval(interval);
      } else {
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes.toString().padStart(2, '0')}m`);
        } else {
          setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Socket setup
  useEffect(() => {
    if (!sessionId) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const newSocket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      newSocket.emit('session:join', { sessionId, role: 'receiver', token });
    });

    newSocket.on('job:created', (jobData: PrintJob) => {
      setJobs(prev => {
        if (prev.some(j => j.id === jobData.id)) return prev;
        return [jobData, ...prev];
      });
    });

    newSocket.on('job:ready', (data: { jobId: string; originalFilename: string; status: string; url: string }) => {
      setJobs(prev =>
        prev.map(job =>
          job.id === data.jobId ? ({ ...job, status: data.status, url: data.url } as PrintJob) : job
        )
      );
    });

    newSocket.on('job:deleted', (data: { jobId: string }) => {
      setJobs(prev => prev.filter(job => job.id !== data.jobId));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, token]);

  const handleAccessSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessQuery.trim()) return;

    setAccessLoading(true);
    setAccessError(null);

    try {
      const res = await fetch(`/api/session/find?query=${encodeURIComponent(accessQuery.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setAccessError(data.error || 'Session not found. Check code or name.');
        setAccessLoading(false);
        return;
      }

      loadSessionData(data.session, data.token);
      setSearchParams({ name: data.session.name });
      setShowAccessModal(false);
      setAccessQuery('');
    } catch (err) {
      setAccessError('Connection error. Please try again.');
    } finally {
      setAccessLoading(false);
    }
  };

  const handleCreateCustomSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSessionName.trim() || undefined,
          durationMinutes: parseInt(newDuration, 10)
        })
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setToken(data.token);
      setSessionName(data.name);
      setSessionCode(data.code);
      setExpiresAt(data.expiresAt);
      setJobs([]);
      setSearchParams({ name: data.name });
      setShowCreateModal(false);
      setNewSessionName('');
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setCreateLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (!sessionCode) return;
    navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const baseUrl = appUrl || window.location.origin;
  const displayHost = appUrl ? appUrl.replace(/^https?:\/\//, '') : window.location.host;

  const copyLinkToClipboard = () => {
    const link = `${baseUrl}/join?code=${sessionCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDelete = async (jobId: string) => {
    try {
      setJobs(prev => prev.filter(job => job.id !== jobId));
      await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    } catch (e) {
      console.error('Failed to delete', e);
    }
  };

  const handlePrint = (job: PrintJob) => {
    try {
      const isImage = job.mimeType.startsWith('image/');
      const viewUrl = `/api/view/${job.id}`;

      // Clean up previous print frame
      const existing = document.getElementById('qprint-print-frame');
      if (existing) existing.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'qprint-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      if (isImage) {
        const frameDoc = iframe.contentWindow?.document;
        if (frameDoc) {
          frameDoc.open();
          frameDoc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${job.originalFilename}</title>
                <style>
                  @page { margin: 0; size: auto; }
                  body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
                  img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                </style>
              </head>
              <body>
                <img src="${viewUrl}" onload="setTimeout(function(){ window.focus(); window.print(); }, 200);" />
              </body>
            </html>
          `);
          frameDoc.close();
          return;
        }
      }

      // For PDFs or other files
      iframe.src = viewUrl;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            const w = window.open(viewUrl, '_blank');
            w?.focus();
          }
        }, 500);
      };
    } catch (e) {
      console.error('Failed to print', e);
      window.open(`/api/view/${job.id}`, '_blank');
    }
  };

  const handlePreview = (job: PrintJob) => {
    window.open(`/api/view/${job.id}`, '_blank');
  };

  const handleDownload = (job: PrintJob) => {
    try {
      const url = `/api/download/${job.id}`;
      window.open(url, '_blank');
    } catch (e) {
      console.error('Failed to download', e);
    }
  };

  const sendUrl = sessionId && token ? `${baseUrl}/send/${sessionId}?token=${token}` : '';

  if (loading || !sessionId) {
    return (
      <div className="min-h-dvh bg-[#f4f4f5] flex flex-col items-center justify-center font-sans text-gray-500 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-gray-800" />
        <span className="text-xs uppercase tracking-widest font-['JetBrains_Mono',_monospace]">Initializing workspace...</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f4f4f5] relative overflow-hidden flex flex-col font-sans text-gray-900 selection:bg-black selection:text-white">
      <Seo
        title="QPrint Drop | QR & Code File Transfer"
        description="Share temporary session code or name, let anyone add files, and manage your live print queue."
        canonicalPath="/"
      />

      {/* Floating Navbar */}
      <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between bg-[#111] px-5 py-2.5 sm:px-6 sm:py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 w-[92%] max-w-xl hover:border-white/20 transition-colors duration-300">
        <div className="flex items-center space-x-2 text-white font-['Playfair_Display',_serif] text-lg sm:text-xl">
          <QrCode size={20} className="text-gray-400" />
          <span className="tracking-tight">QPrint</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAccessModal(true)}
            className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-full transition-all active:scale-95 border border-white/10 font-['Inter',_sans-serif]"
            title="Access existing session by name or code"
          >
            <LogIn size={13} />
            <span className="hidden sm:inline">Access</span> Session
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 bg-white text-black hover:bg-gray-200 text-xs px-3.5 py-1.5 rounded-full transition-all active:scale-95 font-semibold shadow-sm font-['Inter',_sans-serif]"
            title="Create a new custom session"
          >
            <Plus size={13} />
            <span>New</span>
          </button>

          <Link
            to="/join"
            className="hidden md:flex items-center space-x-1 text-gray-400 hover:text-white text-xs px-2 py-1 transition-colors font-['Inter',_sans-serif]"
          >
            <span>Sender Mode</span>
          </Link>
        </div>
      </nav>

      {/* Watermark Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex justify-center items-center">
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[140%] opacity-[0.15] flex justify-between transform -rotate-12 scale-110 text-[#a1a1aa] font-['JetBrains_Mono',_monospace] text-xs tracking-[0.2em] leading-[4] select-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex flex-col whitespace-nowrap">
              {Array.from({ length: 25 }).map((_, j) => (
                <span key={j}>payload.buffer packet.transfer socket.print queue.sync </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="max-w-[1400px] w-full mx-auto flex-1 flex flex-col lg:flex-row items-center justify-center relative z-10 px-6 sm:px-8 pt-24 sm:pt-22 pb-4">
        {/* Left Side: Hero, Session Details, QR & Code */}
        <div className="w-full lg:w-[55%] lg:pr-12 flex flex-col justify-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 w-max mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-['JetBrains_Mono',_monospace] uppercase tracking-wider text-gray-700">
              Session Live &bull; {timeLeft}
            </span>
          </div>

          <h1 className="text-[2.2rem] sm:text-[3rem] lg:text-[3.8rem] xl:text-[4.8rem] font-['Playfair_Display',_serif] text-[#111] leading-[1.05] tracking-tight mb-4">
            Direct drop<br />for your team
          </h1>

          <p className="font-['Inter',_sans-serif] text-gray-500 text-xs sm:text-sm max-w-lg leading-relaxed mb-6">
            Share this temporary session by <strong className="text-gray-900 font-semibold">Name</strong> or <strong className="text-gray-900 font-semibold">6-Digit Code</strong>. Anyone can open it on their device to drop files directly into your queue.
          </p>

          {/* Session Details Card */}
          <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-6 sm:p-7 border border-white shadow-[0_15px_40px_rgba(0,0,0,0.06)] max-w-xl mb-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
              {/* Session Name & Code */}
              <div>
                <span className="text-[10px] font-['JetBrains_Mono',_monospace] uppercase tracking-widest text-gray-400 block mb-1">
                  Session Name
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-xl sm:text-2xl font-['Playfair_Display',_serif] font-bold text-gray-900">
                    {sessionName}
                  </span>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="p-1.5 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors"
                    title="Change session name"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Join Code Highlight */}
              <div className="bg-[#09090b] text-white rounded-2xl px-5 py-3 flex flex-col justify-center shadow-md">
                <span className="text-[9px] font-['JetBrains_Mono',_monospace] uppercase tracking-widest text-gray-400 block">
                  6-Digit Join Code
                </span>
                <div className="flex items-center space-x-3 mt-0.5">
                  <span className="font-['JetBrains_Mono',_monospace] text-2xl font-bold tracking-widest text-white">
                    {sessionCode.slice(0, 3)} {sessionCode.slice(3)}
                  </span>
                  <button
                    onClick={copyCodeToClipboard}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-300 hover:text-white transition-all active:scale-90"
                    title="Copy code"
                  >
                    {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-row: Quick Actions & QR toggle */}
            <div className="pt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  onClick={copyLinkToClipboard}
                  className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Join Link'}</span>
                </button>

                <a
                  href={`/join?code=${sessionCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 bg-transparent hover:bg-gray-100 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                >
                  <ExternalLink size={13} />
                  <span>Test Sender View</span>
                </a>
              </div>

              <div className="text-[11px] text-gray-400 font-['JetBrains_Mono',_monospace]">
                Join at <span className="text-gray-700 font-semibold">{displayHost}/join</span>
              </div>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex items-center space-x-5">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-200 shrink-0">
              <QRCode value={sendUrl} size={96} fgColor="#111" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-800 mb-1">Scan to drop from phone camera</p>
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs">
                Or type <strong className="text-gray-700">{sessionCode}</strong> at <span className="underline decoration-dotted">{displayHost}/join</span> on any browser.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: The Dark Queue Card */}
        <div className="w-full lg:w-[45%] mt-8 lg:mt-0 flex justify-center lg:justify-end">
          <div className="bg-[#09090b] rounded-[2.5rem] w-full max-w-[480px] h-auto max-h-[80vh] min-h-[420px] lg:h-[65vh] lg:max-h-[600px] lg:min-h-[460px] relative overflow-hidden shadow-2xl border border-gray-800 flex flex-col p-6 lg:p-8">
            {/* Moody background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-[80px] pointer-events-none" />

            {/* Queue Header */}
            <div className="sticky top-0 bg-[#09090b]/90 backdrop-blur-md pb-4 pt-1 z-20 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center space-x-3">
                <h3 className="text-white font-['Playfair_Display',_serif] text-2xl sm:text-3xl tracking-tight">Queue</h3>
                <span className="text-[10px] font-['JetBrains_Mono',_monospace] bg-white/10 text-white/80 px-2.5 py-1 rounded-full border border-white/10 uppercase tracking-widest">
                  {jobs.length} {jobs.length === 1 ? 'file' : 'files'}
                </span>
              </div>

              {jobs.length > 0 && (
                <button
                  onClick={() => {
                    jobs.forEach(j => {
                      if (j.status === 'uploaded') handleDownload(j);
                    });
                  }}
                  className="text-[11px] text-gray-400 hover:text-white flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  title="Download all files"
                >
                  <Download size={12} />
                  <span>Get All</span>
                </button>
              )}
            </div>

            {/* Queue Content */}
            {jobs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-[#27272a]/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl w-full max-w-[320px]">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 text-gray-400">
                    <Loader2 className="animate-spin text-gray-300" size={22} />
                  </div>
                  <span className="font-['Inter',_sans-serif] text-sm font-medium text-gray-200 tracking-tight">
                    Listening for files...
                  </span>
                  <p className="text-xs text-gray-500 mt-1 font-['Inter',_sans-serif]">
                    Files added by anyone using code <strong className="text-white font-mono">{sessionCode}</strong> will arrive instantly.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto pt-4 pb-2 scrollbar-hide">
                {jobs.map(job => (
                  <div
                    key={job.id}
                    className="bg-[#18181b]/70 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col shadow-xl hover:border-white/20 transition-all duration-300 group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3 overflow-hidden pr-2">
                        <div className="bg-white/5 p-2.5 rounded-xl text-gray-400 shrink-0 group-hover:text-white transition-colors">
                          {job.mimeType.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-white font-['Inter',_sans-serif] text-sm font-medium truncate tracking-tight">
                            {job.originalFilename}
                          </p>
                          <p className="text-gray-500 font-['JetBrains_Mono',_monospace] text-[10px] mt-0.5 uppercase tracking-tighter">
                            {(job.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 pl-2">
                        {job.status === 'uploading' ? (
                          <Loader2 size={18} className="text-gray-500 animate-spin" />
                        ) : (
                          <CheckCircle2 size={18} className="text-emerald-400" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full mt-auto">
                      <button
                        onClick={() => handlePrint(job)}
                        disabled={job.status !== 'uploaded'}
                        className={`flex-1 py-2.5 rounded-xl flex items-center justify-center space-x-2 font-['Inter',_sans-serif] text-xs font-semibold transition-all active:scale-[0.98] ${
                          job.status === 'uploaded'
                            ? 'bg-white text-black hover:bg-gray-200 shadow-sm'
                            : 'bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                        title="Open print dialog"
                      >
                        <Printer size={14} />
                        <span>Print File</span>
                      </button>
                      <button
                        onClick={() => handlePreview(job)}
                        disabled={job.status !== 'uploaded'}
                        className={`p-2.5 rounded-xl border transition-all active:scale-[0.98] ${
                          job.status === 'uploaded'
                            ? 'bg-transparent border-white/20 text-white hover:bg-white/10'
                            : 'border-transparent bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                        title="Preview / View file"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleDownload(job)}
                        disabled={job.status !== 'uploaded'}
                        className={`p-2.5 rounded-xl border transition-all active:scale-[0.98] ${
                          job.status === 'uploaded'
                            ? 'bg-transparent border-white/20 text-white hover:bg-white/10'
                            : 'border-transparent bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/10 active:scale-[0.98]"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Access Existing Session Modal */}
      {showAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-[2rem] p-7 max-w-md w-full shadow-2xl text-white relative animate-fadeIn">
            <button
              onClick={() => setShowAccessModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-['Playfair_Display',_serif] mb-1">Access Session</h3>
            <p className="text-xs text-gray-400 mb-6 font-['Inter',_sans-serif]">
              Enter a 6-digit code or session name to open its queue on this device.
            </p>

            <form onSubmit={handleAccessSession} className="space-y-4">
              <div>
                <label className="block text-[10px] font-['JetBrains_Mono',_monospace] uppercase tracking-wider text-gray-400 mb-1.5 font-medium">
                  Code or Name
                </label>
                <input
                  type="text"
                  value={accessQuery}
                  onChange={(e) => {
                    setAccessQuery(e.target.value);
                    if (accessError) setAccessError(null);
                  }}
                  placeholder="e.g. 583 912 or my-team-room"
                  autoFocus
                  className="w-full bg-[#27272a] border border-white/10 focus:border-white/40 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-['Inter',_sans-serif]"
                />
              </div>

              {accessError && (
                <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 font-['Inter',_sans-serif]">
                  {accessError}
                </p>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccessModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accessLoading || !accessQuery.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {accessLoading ? 'Searching...' : 'Open Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Custom Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-[2rem] p-7 max-w-md w-full shadow-2xl text-white relative animate-fadeIn">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-['Playfair_Display',_serif] mb-1">New Temporary Session</h3>
            <p className="text-xs text-gray-400 mb-6 font-['Inter',_sans-serif]">
              Name your session and choose how long the temporary queue stays active.
            </p>

            <form onSubmit={handleCreateCustomSession} className="space-y-4">
              <div>
                <label className="block text-[10px] font-['JetBrains_Mono',_monospace] uppercase tracking-wider text-gray-400 mb-1.5 font-medium">
                  Custom Session Name (Optional)
                </label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. DesignReview or AshwinDesk (leave blank for auto)"
                  className="w-full bg-[#27272a] border border-white/10 focus:border-white/40 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-['Inter',_sans-serif]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-['JetBrains_Mono',_monospace] uppercase tracking-wider text-gray-400 mb-1.5 font-medium">
                  Lifespan / Expiry
                </label>
                <select
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-full bg-[#27272a] border border-white/10 focus:border-white/40 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-['Inter',_sans-serif]"
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="240">4 hours</option>
                  <option value="1440">24 hours (default)</option>
                  <option value="4320">3 days</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Developer Credit */}
      <div className="pb-6 w-full flex justify-center z-10">
        <a
          href="https://ashwinharikumar.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center space-x-2 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:border-black transition-all duration-300 active:scale-95"
        >
          <User size={12} className="text-gray-400 group-hover:text-black transition-colors duration-300" />
          <span className="font-['Inter',_sans-serif] text-[11px] font-medium text-gray-500 group-hover:text-black transition-colors duration-300 uppercase tracking-widest">
            Developed by Ashwin Harikumar
          </span>
        </a>
      </div>

      {/* Bottom Logos */}
      <div className="pb-10 w-full flex flex-col items-center justify-center z-10 pointer-events-none mt-auto">
        <p className="text-gray-400 font-['JetBrains_Mono',_monospace] text-[10px] uppercase tracking-[0.3em] mb-6 opacity-60">
          Trusted by networks everywhere
        </p>
        <div className="flex items-center justify-center space-x-16 opacity-20 grayscale contrast-125 scale-90">
          <Cloud size={24} className="text-gray-600" />
          <Database size={24} className="text-gray-600" />
          <Shield size={24} className="text-gray-600" />
          <Wifi size={24} className="text-gray-600" />
          <Server size={24} className="text-gray-600" />
        </div>
      </div>
    </div>
  );
}
