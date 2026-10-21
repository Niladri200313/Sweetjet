'use client';

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Terminal,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Search,
  ArrowLeft,
  Sparkles,
  Download
} from 'lucide-react';

interface DeploymentLogsProps {
  slug: string;
  gitURL: string;
  onDeployAnother: () => void;
}

interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success' | 'upload';
  timestamp: string;
}

export default function DeploymentLogs({ slug, gitURL, onDeployAnother }: DeploymentLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'queued' | 'building' | 'uploading' | 'ready' | 'failed'>('queued');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const deployedUrl = `https://${slug}.sweetjet.site`;

  // Categorize log line helper
  const parseLogLine = (raw: string): LogEntry => {
    let text = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.log) text = parsed.log;
    } catch {
      // already plain text
    }

    const lower = text.toLowerCase();
    let type: LogEntry['type'] = 'info';

    if (lower.includes('error') && !lower.includes('error: no test') && !lower.includes('chunk')) {
      type = 'error';
    } else if (lower.includes('warning') || lower.includes('(!)') || lower.includes('chunks are larger')) {
      type = 'warn';
    } else if (lower.includes('done') || lower.includes('exited with code 0') || lower.includes('built in') || lower.includes('ready')) {
      type = 'success';
    } else if (lower.includes('uploading') || lower.includes('uploaded')) {
      type = 'upload';
    }

    return {
      id: Math.random().toString(36).substring(2, 9),
      text,
      type,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
  };

  useEffect(() => {
    // Add initial queued message
    setLogs([
      {
        id: 'init-1',
        text: `Deployment initiated for project "${slug}" from ${gitURL}`,
        type: 'info',
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      },
      {
        id: 'init-2',
        text: `Spinning up AWS ECS Fargate container with ID: ${slug}...`,
        type: 'info',
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      },
    ]);

    // Connect to Socket.io on port 9002
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:9002';
    const socket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Join project logs room
      socket.emit('subscribe', `logs:${slug}`);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('message', (message: string) => {
      const entry = parseLogLine(message);

      setLogs((prev) => [...prev, entry]);

      // State progression detection
      const lower = entry.text.toLowerCase();
      if (lower.includes('done') || lower.includes('process exited with code 0')) {
        setStatus('ready');
      } else if (lower.includes('uploading')) {
        setStatus('uploading');
      } else if (lower.includes('cloning') || lower.includes('npm install') || lower.includes('vite build')) {
        setStatus('building');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [slug, gitURL]);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const copyUrl = () => {
    navigator.clipboard.writeText(deployedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((l) =>
    l.text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-200">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onDeployAnother}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Deploy Another Project</span>
        </button>

        {/* Live Socket Status */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
          ></span>
          <span className="text-slate-500 font-mono text-[11px]">
            {isConnected ? 'Live Socket Connected (Port 9002)' : 'Connecting to Socket...'}
          </span>
        </div>
      </div>

      {/* Deployment Status Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 font-mono">{slug}</h2>
            {/* Status Pill */}
            {status === 'ready' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ready & Live</span>
              </span>
            )}
            {status === 'building' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                <RotateCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>Building ECS Task</span>
              </span>
            )}
            {status === 'uploading' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
                <Download className="w-3.5 h-3.5 text-purple-600 animate-bounce" />
                <span>Uploading to S3</span>
              </span>
            )}
            {status === 'queued' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Queued on AWS Fargate</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate max-w-md">
            Repository: <span className="font-mono text-slate-700">{gitURL}</span>
          </p>
        </div>

        {/* Live URL box if ready */}
        {status === 'ready' ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl font-mono text-xs text-emerald-900 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{deployedUrl}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={copyUrl}
                title="Copy URL"
                className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors shadow-sm"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95"
              >
                <span>Open Project</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>Logs will stream below in real time</span>
          </div>
        )}
      </div>

      {/* Real-World Public URI Banner (When deployment is ready) */}
      {status === 'ready' && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-900">🌐 Real-World Direct Access:</span>
            <p className="text-slate-500">
              No DNS configuration needed! Open via direct path:{" "}
              <a
                href={`http://localhost:8000/${slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-slate-800 underline font-semibold ml-1"
              >
                http://localhost:8000/{slug}/
              </a>
            </p>
          </div>
          <div className="text-[11px] text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
            To share with world: <code className="text-slate-800">npx localtunnel --port 8000</code>
          </div>
        </div>
      )}

      {/* Terminal Live Logs Box */}
      <div className="bg-[#0F172A] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Terminal Header */}
        <div className="px-4 py-3 bg-[#1E293B]/70 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]/80"></span>
              <span className="w-3 h-3 rounded-full bg-[#F59E0B]/80"></span>
              <span className="w-3 h-3 rounded-full bg-[#10B981]/80"></span>
            </div>
            <span className="text-slate-400 font-mono text-[11px] ml-2 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>build-server/output.log</span>
            </span>
          </div>

          {/* Search & Auto-scroll controls */}
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter logs..."
                className="pl-8 pr-3 py-1 bg-slate-900/80 border border-slate-700/60 rounded-md text-[11px] text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-slate-500 w-36 font-mono"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-400 hover:text-slate-300">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
              />
              <span>Auto-scroll</span>
            </label>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 sm:p-5 font-mono text-xs overflow-y-auto max-h-[440px] space-y-1.5 leading-relaxed selection:bg-slate-700 selection:text-white">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              let textColor = 'text-slate-300';
              if (log.type === 'error') textColor = 'text-rose-400 bg-rose-950/20 px-1 py-0.5 rounded';
              if (log.type === 'warn') textColor = 'text-amber-300';
              if (log.type === 'success') textColor = 'text-emerald-400 font-semibold';
              if (log.type === 'upload') textColor = 'text-cyan-300';

              return (
                <div key={log.id} className="flex items-start gap-3 hover:bg-slate-800/30 px-1.5 py-0.5 rounded transition-colors">
                  <span className="text-slate-600 select-none text-[10px] shrink-0 pt-0.5">
                    {log.timestamp}
                  </span>
                  <span className={`break-all whitespace-pre-wrap ${textColor}`}>
                    {log.text}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Waiting for incoming ECS logs on channel <code className="text-slate-400">logs:{slug}</code>...
            </div>
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Terminal Footer */}
        <div className="px-4 py-2 bg-[#1E293B]/40 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>{filteredLogs.length} total entries</span>
          <span>Target S3: sweetjet/__output/{slug}/</span>
        </div>
      </div>
    </div>
  );
}
