'use client';

import React, { useState } from 'react';
import { X, Github, Sparkles, CheckCircle2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDemoLogin: (user: { name: string; username: string; email: string }) => void;
}

export default function AuthModal({ isOpen, onClose, onDemoLogin }: AuthModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSocialLogin = async (provider: 'github' | 'google') => {
    try {
      setLoading(provider);
      setErrorMsg(null);
      const res = await authClient.signIn.social({
        provider,
        callbackURL: window.location.origin,
      });

      // Explicitly redirect if Better-Auth returned the OAuth authorize URL
      if (res?.data?.url) {
        window.location.href = res.data.url;
        return;
      }

      if (res?.error) {
        throw new Error(res.error.message || `${provider} authentication failed`);
      }
    } catch (err: any) {
      console.error(`${provider} login failed:`, err);
      setErrorMsg(err?.message || 'Login error occurred. Try again or check GitHub settings.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-8 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md mb-3">
            <svg width="22" height="22" viewBox="0 0 115 100" fill="currentColor">
              <path d="M57.5 0L115 100H0L57.5 0Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Welcome to CloudDeploy</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            Sign in to import your GitHub repositories and deploy with real-time logs.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Auth Buttons */}
        <div className="space-y-3">
          {/* GitHub Login */}
          <button
            onClick={() => handleSocialLogin('github')}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
          >
            <Github className="w-4 h-4" />
            <span>{loading === 'github' ? 'Connecting to GitHub...' : 'Continue with GitHub'}</span>
          </button>

          {/* Google Login */}
          <button
            onClick={() => handleSocialLogin('google')}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-300 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
          >
            {/* Google SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-slate-200"></div>
          <span className="absolute bg-white px-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
            Or test immediately
          </span>
        </div>

        {/* Instant Demo Login Button */}
        <button
          onClick={() => {
            onDemoLogin({
              name: 'Niladri Santra',
              username: 'Niladri035',
              email: 'santraniladri@gmail.com',
            });
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs border border-emerald-200 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Quick Login as Niladri035 (Auto-fill Repos)</span>
        </button>
      </div>
    </div>
  );
}
