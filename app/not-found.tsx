import Link from 'next/link';
import { Wind } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center mx-auto border border-teal-500/20">
          <Wind className="w-8 h-8 text-teal-400" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">404</h1>
          <p className="text-slate-400">This page could not be found.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-semibold hover:from-teal-400 hover:to-emerald-400 transition-all shadow-lg shadow-teal-500/20"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

