'use client';

import React, { useState, useEffect } from 'react';
import {
  Github,
  GitBranch,
  Folder,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Rocket,
  ArrowLeft,
  Settings2,
  KeyRound,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { RepoItem } from './RepoList';

export interface EnvVariable {
  key: string;
  value: string;
}

interface ProjectConfigModalProps {
  repo: RepoItem;
  onBack: () => void;
  onDeploy: (config: {
    gitURL: string;
    slug: string;
    rootDirectory: string;
    buildCommand: string;
    outputDirectory: string;
    envVariables: EnvVariable[];
  }) => void;
}

// ── Framework detection ────────────────────────────────────────────────────
type FrameworkInfo = {
  name: string;
  label: string;
  buildCommand: string;
  outputDirectory: string;
  icon: string;
};

function detectFramework(pkg: Record<string, any> | null, hasIndexHtml: boolean): FrameworkInfo {
  if (!pkg) {
    if (hasIndexHtml) {
      return { name: 'StaticHTML', label: 'Static HTML / CSS / JS', buildCommand: '', outputDirectory: './', icon: '🌐' };
    }
    return { name: 'Other', label: 'Custom / Other', buildCommand: 'npm run build', outputDirectory: 'dist', icon: '⚙️' };
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps['next'])
    return { name: 'Next.js', label: 'Next.js App', buildCommand: 'npm run build', outputDirectory: '.next', icon: '▲' };
  if (deps['@remix-run/react'] || deps['@remix-run/node'])
    return { name: 'Remix', label: 'Remix App', buildCommand: 'npm run build', outputDirectory: 'build', icon: '💿' };
  if (deps['vite'])
    return { name: 'Vite', label: 'Vite / React SPA', buildCommand: 'npm run build', outputDirectory: 'dist', icon: '⚡' };
  if (deps['react-scripts'])
    return { name: 'CRA', label: 'Create React App', buildCommand: 'npm run build', outputDirectory: 'build', icon: '⚛️' };
  if (deps['vue'] || deps['@vue/cli-service'])
    return { name: 'Vue', label: 'Vue.js App', buildCommand: 'npm run build', outputDirectory: 'dist', icon: '💚' };
  if (deps['svelte'] || deps['@sveltejs/kit'])
    return { name: 'Svelte', label: 'Svelte / SvelteKit', buildCommand: 'npm run build', outputDirectory: 'build', icon: '🧡' };
  if (deps['astro'])
    return { name: 'Astro', label: 'Astro Site', buildCommand: 'npm run build', outputDirectory: 'dist', icon: '🚀' };

  const hasBuildScript = pkg.scripts?.build;
  if (!hasBuildScript && hasIndexHtml)
    return { name: 'StaticHTML', label: 'Static HTML / CSS / JS', buildCommand: '', outputDirectory: './', icon: '🌐' };

  return { name: 'Other', label: 'Custom / Other', buildCommand: pkg.scripts?.build || 'npm run build', outputDirectory: 'dist', icon: '⚙️' };
}

// ─────────────────────────────────────────────────────────────────────────
export default function ProjectConfigModal({ repo, onBack, onDeploy }: ProjectConfigModalProps) {
  const defaultSlug = repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 18);
  const [slug, setSlug] = useState(defaultSlug || 'my-project');
  const [rootDirectory, setRootDirectory] = useState('./');
  const [preset, setPreset] = useState('Vite');
  const [detectedFramework, setDetectedFramework] = useState<FrameworkInfo | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  const [showBuildSettings, setShowBuildSettings] = useState(false);
  const [showEnvSettings, setShowEnvSettings] = useState(true);

  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDirectory, setOutputDirectory] = useState('dist');

  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // ── Auto-detect framework from GitHub ─────────────────────────────────
  useEffect(() => {
    async function autoDetect() {
      setIsDetecting(true);
      try {
        const [owner, repoName] = repo.fullName.split('/');
        const branch = repo.defaultBranch || 'main';

        const [pkgRes, htmlRes] = await Promise.all([
          fetch(`https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/package.json`),
          fetch(`https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/index.html`),
        ]);

        const hasIndexHtml = htmlRes.ok;
        let pkg: Record<string, any> | null = null;
        if (pkgRes.ok) {
          try { pkg = await pkgRes.json(); } catch { pkg = null; }
        }

        const fw = detectFramework(pkg, hasIndexHtml);
        setDetectedFramework(fw);
        setPreset(fw.name);
        setBuildCommand(fw.buildCommand);
        setOutputDirectory(fw.outputDirectory);
      } catch {
        setDetectedFramework(null);
      } finally {
        setIsDetecting(false);
      }
    }
    autoDetect();
  }, [repo.fullName, repo.defaultBranch]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const presets: Record<string, { buildCommand: string; outputDirectory: string }> = {
      'Vite':       { buildCommand: 'npm run build', outputDirectory: 'dist' },
      'Next.js':    { buildCommand: 'npm run build', outputDirectory: '.next' },
      'CRA':        { buildCommand: 'npm run build', outputDirectory: 'build' },
      'Vue':        { buildCommand: 'npm run build', outputDirectory: 'dist' },
      'Svelte':     { buildCommand: 'npm run build', outputDirectory: 'build' },
      'Astro':      { buildCommand: 'npm run build', outputDirectory: 'dist' },
      'Remix':      { buildCommand: 'npm run build', outputDirectory: 'build' },
      'StaticHTML': { buildCommand: '',              outputDirectory: './' },
      'Other':      { buildCommand: 'npm run build', outputDirectory: 'dist' },
    };
    if (presets[value]) {
      setBuildCommand(presets[value].buildCommand);
      setOutputDirectory(presets[value].outputDirectory);
    }
  };

  const handleAddEnv = () => {
    if (!newKey.trim()) return;
    setEnvVariables([...envVariables, { key: newKey.trim(), value: newValue.trim() }]);
    setNewKey('');
    setNewValue('');
  };

  const handleRemoveEnv = (index: number) => {
    setEnvVariables(envVariables.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDeploy({
      gitURL: repo.gitUrl,
      slug: slug.trim() || defaultSlug,
      rootDirectory,
      buildCommand,
      outputDirectory,
      envVariables,
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-6 animate-in fade-in duration-200">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to repositories</span>
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-floating p-6 sm:p-8 space-y-7">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">New Project</h2>
          <p className="text-xs text-slate-500 mt-1">Configure deployment settings, presets, and environment variables.</p>
        </div>

        {/* Repo banner */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs text-slate-400 font-medium">Importing from GitHub:</span>
            <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800 truncate">
              <Github className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{repo.fullName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
            <GitBranch className="w-3 h-3" />
            <span>{repo.defaultBranch || 'main'}</span>
          </div>
        </div>

        {/* ── Auto-detection badge ── */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border bg-slate-50 border-slate-200">
          {isDetecting ? (
            <>
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              <span className="text-xs text-slate-500">Detecting framework from repository…</span>
            </>
          ) : detectedFramework ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-slate-700 font-medium">
                Detected: <span className="font-bold text-slate-900">{detectedFramework.icon} {detectedFramework.label}</span>
              </span>
              <span className="ml-auto text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">auto</span>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-500">⚙️ Could not detect framework — please select manually.</span>
            </>
          )}
        </div>

        <p className="text-xs text-slate-600 font-medium">
          Choose where you want to create the project and give it a name.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Team & Project Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Team */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Cloud Team</label>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-medium truncate">Niladri Santra&apos;s projects</span>
                  <span className="text-[10px] px-1 bg-white border border-slate-200 rounded text-slate-500">Hobby</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </div>

            {/* Project Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Project Name (Subdomain Slug)</label>
              <div className="relative">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="project-slug"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-mono">
                  .sweetjet.site
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Root Directory & Preset */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Root Directory */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Root Directory</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus-within:border-slate-400">
                <Folder className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={rootDirectory}
                  onChange={(e) => setRootDirectory(e.target.value)}
                  className="w-full bg-transparent font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Framework Preset — auto-selected but overridable */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Application Preset
                {!isDetecting && detectedFramework && (
                  <span className="ml-2 text-[10px] text-emerald-600 font-normal">auto-detected</span>
                )}
              </label>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-slate-400 transition-all"
              >
                <option value="Vite">⚡ Vite / React SPA</option>
                <option value="Next.js">▲ Next.js App</option>
                <option value="CRA">⚛️ Create React App</option>
                <option value="Vue">💚 Vue.js</option>
                <option value="Svelte">🧡 Svelte / SvelteKit</option>
                <option value="Astro">🚀 Astro</option>
                <option value="Remix">💿 Remix</option>
                <option value="StaticHTML">🌐 Static HTML / CSS / JS</option>
                <option value="Other">⚙️ Custom / Other</option>
              </select>
            </div>
          </div>

          {/* Accordion: Build and Output Settings */}
          <div className="border border-slate-200 rounded-xl overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowBuildSettings(!showBuildSettings)}
              className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Build and Output Settings</span>
              </div>
              {showBuildSettings ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {showBuildSettings && (
              <div className="p-4 bg-white border-t border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Build Command</label>
                    <input
                      type="text"
                      value={buildCommand}
                      onChange={(e) => setBuildCommand(e.target.value)}
                      placeholder={preset === 'StaticHTML' ? '(no build needed)' : 'npm run build'}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 placeholder:text-slate-300"
                    />
                    {preset === 'StaticHTML' && (
                      <p className="text-[10px] text-emerald-600">Static project — files uploaded directly to S3, no build needed!</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Output Directory</label>
                    <input
                      type="text"
                      value={outputDirectory}
                      onChange={(e) => setOutputDirectory(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion: Environment Variables */}
          <div className="border border-slate-200 rounded-xl overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowEnvSettings(!showEnvSettings)}
              className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Environment Variables</span>
                {envVariables.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {envVariables.length}
                  </span>
                )}
              </div>
              {showEnvSettings ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {showEnvSettings && (
              <div className="p-4 bg-white border-t border-slate-100 space-y-4">
                <p className="text-[11px] text-slate-500">
                  Inject environment variables into the AWS ECS Fargate container during build and deployment.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                    placeholder="EXAMPLE_API_KEY"
                    className="w-full sm:w-1/2 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 uppercase placeholder:normal-case"
                  />
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="value..."
                    className="w-full sm:w-1/2 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddEnv}
                    disabled={!newKey.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {envVariables.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {envVariables.map((env, index) => (
                      <div key={index} className="p-2.5 flex items-center justify-between text-xs font-mono bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-800">{env.key}</span>
                          <span className="text-slate-400">=</span>
                          <span className="text-slate-600 truncate max-w-xs">{env.value}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEnv(index)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deploy button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isDetecting}
              className="w-full py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isDetecting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Detecting framework…</span></>
              ) : (
                <><Rocket className="w-4 h-4 text-emerald-400" /><span>Deploy</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
