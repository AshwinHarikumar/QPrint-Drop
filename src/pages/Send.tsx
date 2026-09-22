import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import { io, Socket } from 'socket.io-client';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Image as ImageIcon,
  User,
  ArrowLeft,
  Hash,
  Plus,
  ShieldCheck,
  Check
} from 'lucide-react';
import { PrintSettings, TransferSession } from '../../shared/types';
import Seo from '../components/Seo';

interface UploadingFile {
  id: string;
  file: File;
  jobId?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  xhr?: XMLHttpRequest;
  error?: string;
}

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  copies: 1,
  orientation: 'auto',
  colorMode: 'color',
  paperSize: 'A4',
  duplex: 'off'
};

export default function Send() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');

  const [session, setSession] = useState<TransferSession | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(urlToken);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionId) {
      setSessionValid(false);
      return;
    }

    const checkSession = async () => {
      try {
        let res;
        if (activeToken) {
          res = await fetch(`/api/session/${sessionId}?token=${activeToken}`);
        } else {
          res = await fetch(`/api/session/find?query=${encodeURIComponent(sessionId)}`);
        }

        if (res.ok) {
          const data = await res.json();
          setSession(data.session);
          if (data.token) {
            setActiveToken(data.token);
          }
          setSessionValid(true);

          const newSocket = io({ transports: ['websocket', 'polling'] });
          setSocket(newSocket);
          newSocket.on('connect', () => {
            newSocket.emit('session:join', { sessionId, role: 'sender', token: data.token || activeToken });
          });
          newSocket.on('session:joined', (joinedData) => {
            if (joinedData.session) setSession(joinedData.session);
          });
          return () => newSocket.disconnect();
        } else {
          setSessionValid(false);
        }
      } catch (e) {
        setSessionValid(false);
      }
    };
    checkSession();
  }, [sessionId, activeToken]);

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;

    const newUploads: UploadingFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'pending'
    }));

    setUploads(prev => [...newUploads, ...prev]);
    newUploads.forEach(u => processUpload(u));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    handleFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processUpload = async (upload: UploadingFile) => {
    try {
      if (upload.file.size > 500 * 1024 * 1024) {
        throw new Error('File exceeds 500MB limit');
      }

      // Create job on backend
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          token: activeToken,
          originalFilename: upload.file.name,
          mimeType: upload.file.type || 'application/octet-stream',
          fileSize: upload.file.size,
          printSettings: DEFAULT_PRINT_SETTINGS
        })
      });

      if (!res.ok) throw new Error('Failed to initialize transfer');
      const jobData = await res.json();

      const formData = new FormData();
      formData.append('file', upload.file);

      const xhr = new XMLHttpRequest();

      setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, jobId: jobData.id, status: 'uploading', xhr } : u));

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, progress } : u));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'completed', progress: 100 } : u));
        } else {
          setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'failed', error: 'Upload failed' } : u));
        }
      };

      xhr.onerror = () => {
        setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'failed', error: 'Network error' } : u));
      };

      xhr.open('POST', `/api/jobs/${jobData.id}/upload`, true);
      xhr.send(formData);

    } catch (e: any) {
      setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'failed', error: e.message } : u));
    }
  };

  const cancelUpload = (upload: UploadingFile) => {
    if (upload.xhr) upload.xhr.abort();
    setUploads(prev => prev.filter(u => u.id !== upload.id));
  };

  if (sessionValid === null) {
    return (
      <div className="min-h-dvh bg-[#09090b] flex flex-col items-center justify-center font-sans text-gray-400 space-y-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-xs uppercase tracking-widest font-['JetBrains_Mono',_monospace]">Verifying session...</span>
      </div>
    );
  }

  if (sessionValid === false) {
    return (
      <div className="min-h-dvh bg-[#09090b] p-6 flex items-center justify-center font-sans">
        <div className="bg-[#18181b] p-8 rounded-[2.5rem] shadow-2xl border border-red-500/20 text-center max-w-sm w-full">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-['Playfair_Display',_serif] text-white">Session Unavailable</h2>
          <p className="font-['Inter',_sans-serif] text-gray-400 mt-2 text-xs leading-relaxed">
            This transfer session may have expired or does not exist.
          </p>
          <div className="mt-6 flex flex-col space-y-2">
            <Link
              to="/join"
              className="w-full py-3 bg-white text-black font-semibold rounded-xl text-xs hover:bg-gray-200 transition-all text-center"
            >
              Enter Session Code / Name
            </Link>
            <Link
              to="/receive"
              className="w-full py-3 bg-white/5 text-gray-400 hover:text-white rounded-xl text-xs transition-all text-center border border-white/10"
            >
              Create New Session
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = uploads.filter(u => u.status === 'completed').length;

  return (
    <div className="min-h-dvh bg-[#09090b] text-white font-sans pb-12 selection:bg-white/20 selection:text-white relative overflow-hidden flex flex-col justify-between">
      <Seo
        title="Send Files | QPrint Drop"
        description="Connect to a live session and send files instantly."
        canonicalPath="/"
        noindex
      />

      {/* Atmospheric Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-64 bg-white/5 rounded-[100%] blur-[80px] pointer-events-none" />

      {/* Sticky Header with Session Name, Code, and Actions */}
      <header className="sticky top-0 z-20 bg-[#09090b]/70 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <Link
              to="/join"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
              title="Switch Session"
            >
              <ArrowLeft size={14} />
            </Link>
            <div className="overflow-hidden">
              <div className="flex items-center space-x-2">
                <span className="font-['Playfair_Display',_serif] text-base font-semibold text-white tracking-tight">
                  QPrint
                </span>
                {session?.name && (
                  <span className="text-xs bg-white/10 text-gray-200 px-2.5 py-0.5 rounded-full font-['Inter',_sans-serif] truncate max-w-[130px]">
                    {session.name}
                  </span>
                )}
              </div>
              {session?.code && (
                <div className="flex items-center space-x-1 text-[10px] text-gray-400 font-['JetBrains_Mono',_monospace] mt-0.5 tracking-wider">
                  <Hash size={10} className="text-gray-500" />
                  <span>Code: {session.code}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center text-emerald-400 text-[10px] font-['Inter',_sans-serif] font-bold uppercase tracking-widest bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20 shadow-sm">
              <CheckCircle2 size={12} className="mr-1" />
              Connected
            </div>
          </div>
        </div>
      </header>

      {/* Main Send Area */}
      <main className="max-w-md w-full mx-auto p-5 space-y-6 mt-2 relative z-10 flex-1">
        {/* Drop / Tap Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full rounded-[2.5rem] p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 shadow-2xl relative overflow-hidden group border ${
            isDragging
              ? 'bg-white/10 border-white shadow-[0_0_30px_rgba(255,255,255,0.15)] scale-[1.01]'
              : 'bg-gradient-to-b from-[#18181b] to-[#09090b] border-white/10 hover:border-white/30 active:scale-[0.98]'
          }`}
        >
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-5 border transition-all duration-500 shadow-inner ${
              isDragging
                ? 'bg-white text-black border-white scale-110'
                : 'bg-white/5 border-white/10 text-gray-300 group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white'
            }`}
          >
            <UploadCloud size={28} />
          </div>

          <h2 className="font-['Inter',_sans-serif] font-semibold text-white text-base mb-1 tracking-tight">
            {isDragging ? 'Drop files to send' : 'Tap or drop files to send'}
          </h2>
          <p className="font-['JetBrains_Mono',_monospace] text-[11px] uppercase tracking-[0.18em] text-gray-500 group-hover:text-gray-400 transition-colors">
            Images &bull; PDFs &bull; Docs &bull; Any File
          </p>
          <span className="text-[10px] text-gray-500 mt-3 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            Up to 500 MB per file
          </span>
        </div>

        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />

        {/* Uploads List */}
        {uploads.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-['Inter',_sans-serif] font-semibold text-gray-300 tracking-tight">
                Transferred Files ({uploads.length})
              </span>
              {completedCount > 0 && (
                <span className="text-[10px] font-['JetBrains_Mono',_monospace] uppercase tracking-wider text-emerald-400 flex items-center space-x-1">
                  <Check size={11} />
                  <span>{completedCount} sent</span>
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {uploads.map(upload => (
                <div
                  key={upload.id}
                  className="bg-[#18181b]/70 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/10 group hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-3 overflow-hidden pr-2">
                      <div className="bg-white/5 p-2 rounded-xl text-gray-400 shrink-0 group-hover:text-white transition-colors border border-white/5">
                        {upload.file.type.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
                      </div>
                      <div className="overflow-hidden">
                        <span className="font-['Inter',_sans-serif] font-medium text-sm text-gray-200 truncate block tracking-tight">
                          {upload.file.name}
                        </span>
                        <span className="font-['JetBrains_Mono',_monospace] text-[10px] text-gray-500 uppercase tracking-wider block mt-0.5">
                          {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {upload.status !== 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelUpload(upload);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all active:scale-90"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                    <div
                      className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                        upload.status === 'completed'
                          ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
                          : upload.status === 'failed'
                          ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
                          : 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                      }`}
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between mt-2 text-[10px] font-['JetBrains_Mono',_monospace] font-medium uppercase tracking-wider">
                    {upload.status === 'failed' ? (
                      <span className="text-red-400">{upload.error}</span>
                    ) : upload.status === 'completed' ? (
                      <span className="text-emerald-400 flex items-center space-x-1">
                        <Check size={11} className="mr-0.5" />
                        <span>Sent to session</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-gray-400">{Math.round(upload.progress)}%</span>
                        <span className="text-gray-400 animate-pulse">Sending...</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick action to add more files */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white transition-all flex items-center justify-center space-x-1.5 active:scale-[0.99]"
            >
              <Plus size={14} />
              <span>Add more files</span>
            </button>
          </div>
        )}

        {/* Security & Live indicator banner */}
        <div className="pt-2 flex items-center justify-center space-x-2 text-[11px] font-['Inter',_sans-serif] text-gray-500">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Files transferred directly to the host session</span>
        </div>
      </main>

      {/* Developer Credit */}
      <footer className="pt-6 w-full flex justify-center z-10">
        <a
          href="https://ashwinharikumar.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-white/10 transition-all duration-300 active:scale-95"
        >
          <User size={12} className="text-gray-400 group-hover:text-white transition-colors duration-300" />
          <span className="font-['Inter',_sans-serif] text-[11px] font-medium text-gray-400 group-hover:text-white transition-colors duration-300 uppercase tracking-widest">
            Developed by Ashwin Harikumar
          </span>
        </a>
      </footer>
    </div>
  );
}
