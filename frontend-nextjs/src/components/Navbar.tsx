'use client';

import React from 'react';
import { Sparkles, ExternalLink, LogOut, Github } from 'lucide-react';

interface NavbarProps {
  user: { name: string; email?: string; image?: string; username?: string } | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export default function Navbar({ user, onOpenAuth, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black text-white shadow-sm">
            {/* Vercel-like triangle */}
            <svg width="14" height="14" viewBox="0 0 115 100" fill="currentColor">
              <path d="M57.5 0L115 100H0L57.5 0Z" />
            </svg>
          </div>
          <span className="font-semibold text-text-primary tracking-tight text-base">
            CloudDeploy
          </span>
          <span className="text-text-muted text-sm">/</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-text-secondary border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{user?.name || "Niladri Santra"}&apos;s projects</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-white rounded text-slate-600 border border-slate-200">Hobby</span>
          </div>
        </div>

        {/* Right Action Items */}
        <div className="flex items-center gap-3">
          {/* Service Status badges */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> API: 9000
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Logs: 9002
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Proxy: 8000
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-600 text-white flex items-center justify-center font-medium text-xs shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left text-xs leading-tight">
                <span className="font-medium text-text-primary">{user.name}</span>
                <span className="text-text-muted">{user.email || `@${user.username || 'user'}`}</span>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 text-text-muted hover:text-red-500 rounded-md hover:bg-red-50 transition-colors ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-black text-white hover:bg-slate-800 text-xs font-medium transition-all shadow-sm active:scale-95"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
