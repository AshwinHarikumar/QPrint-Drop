import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { io, Socket } from 'socket.io-client';
import { PrintJob } from '../../shared/types';
import { FileText, Image as ImageIcon, Trash2, Printer, Download, Eye, QrCode, ChevronDown, Phone, Loader2, ArrowUp, CheckCircle2, Cloud, Database, Shield, Wifi, Server } from 'lucide-react';
import Seo from '../components/Seo';

export default function Receive() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      const data = await res.json();
      setSessionId(data.sessionId);
      setToken(data.token);
      setExpiresAt(data.expiresAt);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft('Expired');
        clearInterval(interval);
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (!sessionId) return;
    
    const newSocket = io({ transports: ['websocket', 'polling'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('session:join', { sessionId, role: 'receiver', token });
    });

    newSocket.on('job:created', (jobData: PrintJob) => {
      setJobs(prev => [jobData, ...prev]);
    });

    newSocket.on('job:ready', (data: { jobId: string; originalFilename: string; status: string; url: string }) => {
       setJobs(prev => prev.map(job => 
         job.id === data.jobId ? { ...job, status: data.status, url: data.url } as PrintJob : job
       ));
    });

    newSocket.on('job:deleted', (data: { jobId: string }) => {
       setJobs(prev => prev.filter(job => job.id !== data.jobId));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, token]);

  const handleDelete = async (jobId: string) => {
    try {
      // Optimistic delete
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

  const handlePrint = async (job: PrintJob) => {
     try {
        const url = `/api/download/${job.id}`;
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
           printWindow.onload = () => {
              printWindow.print();
           };
        }
     } catch(e) {
        console.error('Failed to print', e);
     }
  };

  const handleDownload = async (job: PrintJob) => {
     try {
        const url = `/api/download/${job.id}`;
        window.open(url, '_blank');
     } catch (e) {
        console.error('Failed to download', e);
     }
  };

  if (!sessionId || !token) {
    return <div className="p-10 text-center text-gray-500">Initializing session...</div>;
  }

  const sendUrl = `${window.location.origin}/send/${sessionId}?token=${token}`;

  return (
    <div className="h-screen bg-[#f4f4f5] relative overflow-hidden flex flex-col font-sans text-gray-900 selection:bg-black selection:text-white">
      <Seo
        title="QPrint Drop | QR File Transfer and Mobile Printing"
        description="Generate a QR session, send files from mobile, and manage a live desktop print queue in real time."
        canonicalPath="/"
      />
      
      {/* Navbar */}
      <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center bg-[#111] px-8 py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 w-max hover:border-white/20 transition-colors duration-300 cursor-default">
        <div className="flex items-center space-x-2 text-white font-['Playfair_Display',_serif] text-xl">
          <QrCode size={20} className="text-gray-400" />
          <span className="tracking-tight">QPrint</span>
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

      <div className="max-w-[1400px] w-full mx-auto flex-1 flex flex-col lg:flex-row items-center justify-center relative z-10 px-8 pt-20 pb-4">
        
        {/* Left Side: Hero & Actions */}
        <div className="w-full lg:w-[55%] lg:pr-16 flex flex-col justify-center">
          <h1 className="text-[3rem] sm:text-[4rem] xl:text-[5.5rem] font-['Playfair_Display',_serif] text-[#111] leading-[1.05] tracking-tight mb-6 xl:mb-8">
            Seamless<br />printing<br />forever
          </h1>
          <p className="font-['JetBrains_Mono',_monospace] text-gray-400 text-xs max-w-md leading-relaxed mb-10 uppercase tracking-[0.2em]">
            QR-powered local transfers — built for a world where cables are obsolete.
          </p>

          <div className="bg-white/40 p-3 rounded-[2.5rem] inline-block border border-white shadow-sm backdrop-blur-sm self-start group transition-all duration-500 hover:bg-white/60">
            <div className="bg-[#fcfcfd] rounded-3xl px-8 py-8 shadow-sm flex flex-col items-center border border-white min-w-[280px]">
              {timeLeft === 'Expired' ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center w-[184px] h-[184px] text-gray-400 font-['Inter',_sans-serif] text-sm">
                    Session Expired
                  </div>
                  <button onClick={fetchSession} className="w-full bg-[#27272a] text-white py-3.5 rounded-xl font-['Inter',_sans-serif] text-sm font-medium hover:bg-[#18181b] transition-all active:scale-[0.98]">
                    Generate New QR
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 group-hover:shadow-md transition-shadow duration-300">
                    <QRCode value={sendUrl} size={160} fgColor="#111" />
                  </div>
                  <button className="w-full bg-[#111] text-white py-3.5 rounded-xl font-['Inter',_sans-serif] text-sm font-medium flex items-center justify-center space-x-2 shadow-lg shadow-black/20 hover:bg-black transition-all active:scale-[0.98] group-hover:shadow-black/30">
                    <Phone size={18} />
                    <span>Scan with mobile</span>
                  </button>
                  <p className="text-[10px] font-['Inter',_sans-serif] text-gray-400 mt-4 max-w-[200px] text-center leading-relaxed">
                    By scanning, you acknowledge secure local network transfer.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: The Dark Queue Card */}
        <div className="w-full lg:w-[45%] mt-8 lg:mt-0 flex justify-center lg:justify-end">
          <div className="bg-[#09090b] rounded-[2.5rem] w-full max-w-[480px] h-[65vh] max-h-[600px] min-h-[450px] relative overflow-hidden shadow-2xl border border-gray-800 flex flex-col items-center p-8">
            {/* Moody background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-[80px] pointer-events-none"></div>
            
            {jobs.length === 0 ? (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[340px]">
                <div className="bg-[#27272a]/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-2xl transition-all duration-500">
                  <div className="flex items-center space-x-4 text-gray-400">
                    <div className="relative">
                      <Loader2 className="animate-spin text-gray-300" size={20} />
                      <div className="absolute inset-0 blur-sm bg-white/20 rounded-full animate-pulse"></div>
                    </div>
                    <span className="font-['Inter',_sans-serif] text-sm font-medium text-gray-200 tracking-tight">Awaiting connection...</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                    <ArrowUp size={16} className="text-gray-300" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col space-y-4 overflow-y-auto relative z-10 scrollbar-hide px-2">
                <div className="sticky top-0 bg-[#09090b]/80 backdrop-blur-md pb-6 pt-4 z-20 flex items-center justify-between">
                  <h3 className="text-white font-['Playfair_Display',_serif] text-3xl tracking-tight">Queue</h3>
                  <span className="text-[10px] font-['JetBrains_Mono',_monospace] bg-white/10 text-white/70 px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">
                    {jobs.length} items
                  </span>
                </div>

                <div className="space-y-4 pb-8">
                  {jobs.map(job => (
                    <div key={job.id} className="bg-[#18181b]/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col shadow-xl hover:border-white/20 transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3 overflow-hidden pr-2">
                          <div className="bg-white/5 p-2.5 rounded-xl text-gray-400 shrink-0 group-hover:text-white transition-colors">
                            {job.mimeType.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-white font-['Inter',_sans-serif] text-sm font-medium truncate tracking-tight">{job.originalFilename}</p>
                            <p className="text-gray-500 font-['JetBrains_Mono',_monospace] text-[10px] mt-0.5 uppercase tracking-tighter">{(job.fileSize/1024/1024).toFixed(1)}MB</p>
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
                          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center space-x-2 font-['Inter',_sans-serif] text-xs font-semibold transition-all active:scale-[0.98] ${job.status === 'uploaded' ? 'bg-white text-black hover:bg-gray-200 shadow-sm' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
                        >
                          <Printer size={14} />
                          <span>Print File</span>
                        </button>
                        <button
                          onClick={() => handleDownload(job)}
                          disabled={job.status !== 'uploaded'}
                          className={`p-2.5 rounded-xl border transition-all active:scale-[0.98] ${job.status === 'uploaded' ? 'bg-transparent border-white/20 text-white hover:bg-white/10' : 'border-transparent bg-white/5 text-white/30 cursor-not-allowed'}`}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Logos */}
      <div className="pb-10 w-full flex flex-col items-center justify-center z-10 pointer-events-none mt-auto">
        <p className="text-gray-400 font-['JetBrains_Mono',_monospace] text-[10px] uppercase tracking-[0.3em] mb-6 opacity-60">Trusted by networks everywhere</p>
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
