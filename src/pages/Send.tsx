import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { io, Socket } from 'socket.io-client';
import { UploadCloud, CheckCircle2, AlertCircle, X, Pause, Play, FileText, Image as ImageIcon } from 'lucide-react';
import { PrintSettings } from '../../shared/types';

interface UploadingFile {
  id: string; // internal id before job creation
  file: File;
  jobId?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  xhr?: XMLHttpRequest;
  error?: string;
}

export default function Send() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);

  const [settings, setSettings] = useState<PrintSettings>({
    copies: 1,
    orientation: 'auto',
    colorMode: 'color',
    paperSize: 'A4',
    duplex: 'off'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionId || !token) {
      setSessionValid(false);
      return;
    }

    const checkSession = async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}?token=${token}`);

        if (res.ok) {
          setSessionValid(true);
          const newSocket = io({ transports: ['websocket', 'polling'] });
          setSocket(newSocket);
          newSocket.on('connect', () => {
             newSocket.emit('session:join', { sessionId, role: 'sender', token });
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
  }, [sessionId, token]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];

    const newUploads: UploadingFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'pending'
    }));

    setUploads(prev => [...prev, ...newUploads]);
    newUploads.forEach(u => processUpload(u));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processUpload = async (upload: UploadingFile) => {
    try {
      if (upload.file.size > 500 * 1024 * 1024) {
        throw new Error('File too large (max 500MB)');
      }

      // Create job on backend
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           sessionId,
           token, // if token needed for auth
           originalFilename: upload.file.name,
           mimeType: upload.file.type || 'application/octet-stream',
           fileSize: upload.file.size,
           printSettings: settings
        })
      });

      if (!res.ok) throw new Error('Failed to create job');
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
    return <div className="p-8 text-center text-gray-500">Verifying session...</div>;
  }

  if (sessionValid === false) {
    return (
      <div className="min-h-screen bg-[#09090b] p-8 flex items-center justify-center font-sans">
        <div className="bg-[#18181b] p-8 rounded-[2rem] shadow-2xl border border-red-500/20 text-center max-w-sm w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-['Playfair_Display',_serif] text-white">Session Invalid</h2>
          <p className="font-['Inter',_sans-serif] text-gray-400 mt-2 text-sm">This transfer session has expired or is invalid. Please scan a new QR code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans pb-12 selection:bg-white/20 selection:text-white relative overflow-hidden">

      {/* Moody background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-64 bg-white/5 rounded-[100%] blur-[80px] pointer-events-none"></div>

      <div className="sticky top-0 z-20 bg-[#09090b]/60 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <h1 className="font-['Playfair_Display',_serif] text-xl font-medium tracking-tight text-white">QPrint</h1>
          <div className="flex items-center text-emerald-400 text-[10px] font-['Inter',_sans-serif] font-bold uppercase tracking-widest bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 shadow-sm">
            <CheckCircle2 size={12} className="mr-1.5" />
            Connected
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-5 space-y-6 mt-2 relative z-10">

        {/* Upload Area */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-gradient-to-b from-[#18181b] to-[#09090b] border border-white/10 rounded-[2rem] p-10 flex flex-col items-center justify-center text-gray-400 hover:border-white/30 transition-all duration-500 active:scale-[0.98] shadow-2xl group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500 shadow-inner">
            <UploadCloud size={28} className="text-gray-300 group-hover:text-white transition-colors" />
          </div>
          <span className="font-['Inter',_sans-serif] font-medium text-gray-200 text-sm mb-2">Tap to select files</span>
          <span className="font-['JetBrains_Mono',_monospace] text-[10px] uppercase tracking-[0.2em] text-gray-500 group-hover:text-gray-400 transition-colors">PDF • Images • Docs</span>
        </button>
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
            {uploads.map(upload => (
              <div key={upload.id} className="bg-[#18181b]/60 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/10 group hover:border-white/20 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3 overflow-hidden pr-2">
                    <div className="bg-white/5 p-2.5 rounded-xl text-gray-400 shrink-0 group-hover:text-white transition-colors border border-white/5">
                      {upload.file.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="overflow-hidden">
                      <span className="font-['Inter',_sans-serif] font-medium text-sm text-gray-200 truncate block tracking-tight">{upload.file.name}</span>
                      <span className="font-['JetBrains_Mono',_monospace] text-[10px] text-gray-500 uppercase tracking-wider block mt-0.5">
                        {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    {upload.status !== 'completed' && (
                      <button onClick={() => cancelUpload(upload)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div
                    className={`absolute top-0 left-0 h-full transition-all duration-500 ${upload.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : upload.status === 'failed' ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'}`}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>

                <div className="flex justify-between mt-2.5 text-[10px] font-['JetBrains_Mono',_monospace] font-medium uppercase tracking-wider">
                  {upload.status === 'failed' ? (
                    <span className="text-red-400">{upload.error}</span>
                  ) : upload.status === 'completed' ? (
                    <span className="text-emerald-400">Transferred</span>
                  ) : (
                    <>
                      <span className="text-gray-500">{Math.round(upload.progress)}%</span>
                      <span className="text-gray-500 animate-pulse">Uploading...</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        <div className="bg-[#18181b]/50 rounded-[1.5rem] shadow-xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
            <h3 className="font-['Inter',_sans-serif] font-medium text-sm text-gray-200">Print settings</h3>
          </div>
          <div className="p-5 space-y-5 text-sm font-['Inter',_sans-serif]">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Copies</span>
              <select
                value={settings.copies}
                onChange={(e) => setSettings({...settings, copies: parseInt(e.target.value)})}
                className="bg-[#27272a] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20 text-sm font-medium cursor-pointer"
              >
                {[1,2,3,4,5,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Color</span>
              <select
                value={settings.colorMode}
                onChange={(e) => setSettings({...settings, colorMode: e.target.value as any})}
                className="bg-[#27272a] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20 text-sm font-medium cursor-pointer"
              >
                <option value="color">Color</option>
                <option value="bw">B & W</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Paper</span>
              <select
                value={settings.paperSize}
                onChange={(e) => setSettings({...settings, paperSize: e.target.value as any})}
                className="bg-[#27272a] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20 text-sm font-medium cursor-pointer"
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Orientation</span>
              <select
                value={settings.orientation}
                onChange={(e) => setSettings({...settings, orientation: e.target.value as any})}
                className="bg-[#27272a] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20 text-sm font-medium cursor-pointer"
              >
                <option value="auto">Auto</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
