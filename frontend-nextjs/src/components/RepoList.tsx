'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Github,
  ArrowRight,
  RefreshCw,
  Edit2,
  Check,
  X,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export interface RepoItem {
  name: string;
  fullName: string;
  gitUrl: string;
  defaultBranch: string;
  updatedAt: string;
  language?: string;
  description?: string;
}

interface RepoListProps {
  user: { name: string; username?: string; email?: string } | null;
  onSelectRepo: (repo: RepoItem) => void;
  onCustomGitUrl: (url: string) => void;
}

export default function RepoList({ user, onSelectRepo, onCustomGitUrl }: RepoListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Smart resolve GitHub username (handles Gmail vs GitHub handle mismatch)
  const resolveHandle = (u: typeof user) => {
    if (!u) return 'Niladri035';
    const email = (u.email || '').toLowerCase().trim();

    // Priority 1: Direct match for known emails and handles
    if (email.includes('200313') || email === 'niladrisantra276@gmail.com') {
      return 'Niladri200313';
    }
    if (email.includes('035') || email.includes('57') || email.includes('santraniladri')) {
      return 'Niladri035';
    }

    // Priority 2: If username is an explicit valid GitHub handle
    if (u.username && !u.username.includes('@') && u.username !== 'developer' && u.username !== 'user') {
      return u.username;
    }

    return 'Niladri035';
  };

  const initialHandle = resolveHandle(user);
  const [currentUsername, setCurrentUsername] = useState(initialHandle);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsernameInput, setTempUsernameInput] = useState(initialHandle);

  // When user changes from parent, sync handle and immediately fetch their live repos
  useEffect(() => {
    if (user) {
      const handle = resolveHandle(user);
      setCurrentUsername(handle);
      setTempUsernameInput(handle);
      fetchLiveRepos(handle);
    }
  }, [user]);

  // Fetch live repos from GitHub API whenever currentUsername changes
  const fetchLiveRepos = async (handleToFetch = currentUsername) => {
    if (!handleToFetch.trim()) return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`https://api.github.com/users/${handleToFetch.trim()}/repos?sort=updated&per_page=15`);
      if (res.ok) {
        const data = await res.json();
        const formatted: RepoItem[] = data.map((r: any) => ({
          name: r.name,
          fullName: r.full_name,
          gitUrl: r.clone_url || `https://github.com/${r.full_name}.git`,
          defaultBranch: r.default_branch || 'main',
          updatedAt: new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          language: r.language || 'JavaScript',
          description: r.description || '',
        }));
        setRepos(formatted);
      } else if (res.status === 404) {
        setFetchError(`GitHub user "${handleToFetch}" not found.`);
        setRepos([]);
      } else {
        setFetchError('GitHub API limit reached or temporary network issue.');
      }
    } catch (e: any) {
      console.warn('Could not fetch repos from GitHub:', e);
      setFetchError(e?.message || 'Error fetching repositories');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchLiveRepos(currentUsername);
  }, [currentUsername]);

  const handleSaveUsername = () => {
    if (tempUsernameInput.trim()) {
      setCurrentUsername(tempUsernameInput.trim());
      setIsEditingUsername(false);
    }
  };

  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    const url = customUrl.trim();
    // Derive name
    const match = url.match(/\/([^\/]+?)(\.git)?$/);
    const repoName = match ? match[1] : 'my-app';
    onSelectRepo({
      name: repoName,
      fullName: `user/${repoName}`,
      gitUrl: url,
      defaultBranch: 'main',
      updatedAt: 'Just now',
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 py-6 animate-in fade-in duration-200">
      {/* Hero Header with generous breathing space */}
      <div className="space-y-4 text-left">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Let&apos;s build something new
        </h1>
        <p className="text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
          Import a Git repository to deploy with ECS Fargate containers, real-time streaming build logs, and automated subdomain reverse-proxy.
        </p>
      </div>

      {/* Universal Git Input Bar */}
      <form onSubmit={handleCustomSubmit} className="relative">
        <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-400">
          <div className="pl-3 text-slate-400">
            <Github className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Paste any public Git repository URL (e.g. https://github.com/Niladri035/AnantaGita.git)..."
            className="w-full px-2 py-2.5 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!customUrl.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-medium text-xs transition-all shadow-sm shrink-0"
          >
            <span>Import</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Main Grid: Left is Repos, Right is Templates / Fast Start */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Import Git Repository */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header of card */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Import Git Repository</h2>
              <p className="text-xs text-slate-500 mt-0.5">Select a repository to configure deployment</p>
            </div>

            {/* Dynamic GitHub Account Selector Pill */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isEditingUsername ? (
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-300">
                  <Github className="w-3.5 h-3.5 text-slate-600 ml-1" />
                  <input
                    type="text"
                    value={tempUsernameInput}
                    onChange={(e) => setTempUsernameInput(e.target.value)}
                    placeholder="GitHub username"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveUsername();
                      if (e.key === 'Escape') setIsEditingUsername(false);
                    }}
                    className="w-28 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none font-mono"
                  />
                  <button
                    onClick={handleSaveUsername}
                    title="Load this user"
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEditingUsername(false)}
                    title="Cancel"
                    className="p-1 text-slate-400 hover:bg-slate-200 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setTempUsernameInput(currentUsername);
                      setIsEditingUsername(true);
                    }}
                    title="Click to switch or enter GitHub username"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition-colors group"
                  >
                    <Github className="w-3.5 h-3.5 text-slate-600" />
                    <span className="font-mono font-semibold">{currentUsername}</span>
                    <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-slate-700 ml-1" />
                  </button>

                  {/* Refresh button */}
                  <button
                    onClick={() => fetchLiveRepos(currentUsername)}
                    disabled={isFetching}
                    title="Sync GitHub Repos"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search repos */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${currentUsername}'s repositories...`}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>

          {/* Repo List Rows */}
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {isFetching ? (
              <div className="p-10 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-600" />
                <span>Fetching latest repositories for @{currentUsername}...</span>
              </div>
            ) : fetchError ? (
              <div className="p-8 text-center space-y-4">
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fetchError}</span>
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  GitHub uses your unique username handle (e.g. <b>Niladri035</b>), not your full email address.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setCurrentUsername('Niladri035');
                      setTempUsernameInput('Niladri035');
                      fetchLiveRepos('Niladri035');
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                  >
                    Load Repos for @Niladri035
                  </button>
                </div>
              </div>
            ) : filteredRepos.length > 0 ? (
              filteredRepos.map((repo) => (
                <div
                  key={repo.name}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs shrink-0 mt-0.5">
                      {repo.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900 truncate group-hover:text-black">
                          {repo.name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">• {repo.updatedAt}</span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5 max-w-sm">
                          {repo.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectRepo(repo)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium transition-all shadow-sm active:scale-95 shrink-0"
                  >
                    Import
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <p>No repositories found for @{currentUsername} matching &quot;{searchQuery}&quot;</p>
                <p className="text-[11px]">Click the username pill above to enter another GitHub account.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Templates / Starter Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Build your solution</h2>
            <span className="text-xs text-slate-400">Starter presets</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Template 1: AnantaGita */}
            <div
              onClick={() =>
                onSelectRepo({
                  name: 'AnantaGita',
                  fullName: `${currentUsername}/AnantaGita`,
                  gitUrl: 'https://github.com/Niladri035/AnantaGita.git',
                  defaultBranch: 'main',
                  updatedAt: 'Recently updated',
                  description: 'Vite + React single-page app',
                })
              }
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 font-semibold text-xs">
                ⚡
              </div>
              <h3 className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                Vite + React
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Zero-config fast client deployment with auto-routing.
              </p>
            </div>

            {/* Template 2: Next.js Boilerplate */}
            <div
              onClick={() =>
                onSelectRepo({
                  name: 'nextjs-starter',
                  fullName: 'vercel/next-learn',
                  gitUrl: 'https://github.com/vercel/next-learn.git',
                  defaultBranch: 'main',
                  updatedAt: 'Official template',
                  description: 'Next.js App router template',
                })
              }
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-3 font-bold text-xs">
                ▲
              </div>
              <h3 className="font-semibold text-xs text-slate-900 group-hover:text-black transition-colors">
                Next.js Boilerplate
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Production-ready React with server components and assets.
              </p>
            </div>

            {/* Template 3: OpsPilot */}
            <div
              onClick={() =>
                onSelectRepo({
                  name: 'OpsPilot',
                  fullName: `${currentUsername}/OpsPilot`,
                  gitUrl: 'https://github.com/Niladri035/OpsPilot.git',
                  defaultBranch: 'main',
                  updatedAt: 'Aug 23',
                })
              }
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3 font-semibold text-xs">
                🚀
              </div>
              <h3 className="font-semibold text-xs text-slate-900 group-hover:text-emerald-600 transition-colors">
                OpsPilot Cloud
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Automated devops dashboard with ECS task orchestration.
              </p>
            </div>

            {/* Template 4: DSA Solutions */}
            <div
              onClick={() =>
                onSelectRepo({
                  name: 'Binary_Brain-DSA_SOLUTION-',
                  fullName: `${currentUsername}/Binary_Brain-DSA_SOLUTION-`,
                  gitUrl: 'https://github.com/Niladri035/Binary_Brain-DSA_SOLUTION-.git',
                  defaultBranch: 'main',
                  updatedAt: 'Oct 2',
                })
              }
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-3 font-semibold text-xs">
                🧠
              </div>
              <h3 className="font-semibold text-xs text-slate-900 group-hover:text-amber-600 transition-colors">
                Binary Brain DSA
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Interactive DSA visualization and solution hub.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
