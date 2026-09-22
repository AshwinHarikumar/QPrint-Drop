import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router';
import { QrCode, ArrowRight, Loader2, Sparkles, FolderUp, ShieldCheck, AlertCircle, Laptop } from 'lucide-react';
import Seo from '../components/Seo';

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { codeOrName } = useParams();

  const [query, setQuery] = useState(
    codeOrName || searchParams.get('code') || searchParams.get('name') || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (targetQuery?: string) => {
    const value = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!value) {
      setError('Please enter a session code or name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/session/find?query=${encodeURIComponent(value)}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setError(data.error || 'Session not found. Please verify the code or name.');
        setLoading(false);
        return;
      }

      // Found session! Navigate to sender page with token
      navigate(`/send/${data.session.sessionId}?token=${data.token}`);
    } catch (err) {
      console.error('Failed to lookup session:', err);
      setError('Connection failed. Please check your network and try again.');
      setLoading(false);
    }
  };

  // Auto-join if code or name was supplied in URL
  useEffect(() => {
    const initialQuery = codeOrName || searchParams.get('code') || searchParams.get('name');
    if (initialQuery) {
      handleJoin(initialQuery);
    }
  }, [codeOrName]);

  return (
    <div className="min-h-dvh bg-[#09090b] text-white font-sans flex flex-col justify-between selection:bg-white/20 selection:text-white relative overflow-hidden">
      <Seo
        title="Join Session | QPrint Drop"
        description="Enter a 6-digit code or session name to connect and upload files directly to a live queue."
        canonicalPath="/join"
      />

      {/* Atmospheric Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-96 bg-gradient-to-b from-white/10 via-white/5 to-transparent rounded-[100%] blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
        <Link to="/receive" className="flex items-center space-x-2 text-white font-['Playfair_Display',_serif] text-xl group">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-colors">
            <QrCode size={18} className="text-gray-300 group-hover:text-white transition-colors" />
          </div>
          <span className="tracking-tight">QPrint</span>
        </Link>

        <Link
          to="/receive"
          className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full text-xs font-medium text-gray-300 hover:text-white transition-all duration-300 active:scale-95"
        >
          <Laptop size={14} className="text-gray-400" />
          <span>Host / Receive</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-[#18181b]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
            {/* Top Accent Icon */}
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner text-white">
              <FolderUp size={26} className="text-gray-300" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-['Playfair_Display',_serif] text-white tracking-tight mb-2">
              Join Session
            </h1>
            <p className="font-['Inter',_sans-serif] text-gray-400 text-xs sm:text-sm leading-relaxed mb-8">
              Enter the 6-digit code or custom name shared by the host to upload files into their live queue.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoin();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-['JetBrains_Mono',_monospace] uppercase tracking-wider text-gray-400 mb-2 font-medium">
                  Session Code or Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. 583 912 or team-print"
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    className="w-full bg-[#27272a]/60 border border-white/10 focus:border-white/40 rounded-2xl px-4 py-3.5 text-base font-medium text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all font-['Inter',_sans-serif] tracking-wide"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-['Inter',_sans-serif] animate-fadeIn">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className={`w-full py-4 rounded-2xl font-['Inter',_sans-serif] text-sm font-semibold flex items-center justify-center space-x-2 transition-all duration-300 shadow-xl ${
                  loading || !query.trim()
                    ? 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/5'
                    : 'bg-white text-black hover:bg-gray-100 hover:shadow-white/10 active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Connecting to session...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Session</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Feature Badges */}
            <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-3 text-[11px] font-['Inter',_sans-serif] text-gray-400">
              <div className="flex items-center space-x-2">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                <span>Zero signup required</span>
              </div>
              <div className="flex items-center space-x-2">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <span>Real-time live queue</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-gray-500 text-xs font-['JetBrains_Mono',_monospace] tracking-wider uppercase">
        Encrypted local peer network &bull; Temporary storage
      </footer>
    </div>
  );
}
