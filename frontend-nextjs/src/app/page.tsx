'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import RepoList, { RepoItem } from '@/components/RepoList';
import ProjectConfigModal, { EnvVariable } from '@/components/ProjectConfigModal';
import DeploymentLogs from '@/components/DeploymentLogs';
import AuthModal from '@/components/AuthModal';
import { authClient } from '@/lib/auth-client';

export default function Home() {
  const [user, setUser] = useState<{
    name: string;
    username: string;
    email: string;
  } | null>(null);

  // Sync real session from Better Auth on load
  useEffect(() => {
    async function loadUserSession() {
      try {
        const session = await (authClient as any).getSession();
        if (session?.data?.user) {
          const u = session.data.user;

          // Dynamically fetch real GitHub username from our API route
          let githubUsername = '';
          try {
            const ghRes = await fetch('/api/me/github');
            if (ghRes.ok) {
              const ghData = await ghRes.json();
              githubUsername = ghData.username || '';
            }
          } catch { /* API unavailable */ }

          // Fallback: use display name stripped of spaces
          if (!githubUsername) {
            githubUsername = u.name?.replace(/\s+/g, '') || 'user';
          }

          setUser({
            name: u.name || 'Developer',
            username: githubUsername,
            email: u.email || '',
          });
          return;
        }
      } catch (err) {
        console.warn('Session check:', err);
      }
      // Not logged in
      setUser(null);
    }
    loadUserSession();
  }, []);


  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // View state: 'repos' | 'config' | 'logs'
  const [currentView, setCurrentView] = useState<'repos' | 'config' | 'logs'>('repos');

  // Currently selected repo for config
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);

  // Active deployment data
  const [activeDeployment, setActiveDeployment] = useState<{
    slug: string;
    gitURL: string;
  } | null>(null);

  // Handle repository selection
  const handleSelectRepo = (repo: RepoItem) => {
    setSelectedRepo(repo);
    setCurrentView('config');
  };

  // Handle deployment trigger
  const handleDeploy = async (config: {
    gitURL: string;
    slug: string;
    rootDirectory: string;
    buildCommand: string;
    outputDirectory: string;
    envVariables: EnvVariable[];
  }) => {
    try {
      const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:9000';

      const res = await fetch(`${apiServerUrl}/project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitURL: config.gitURL,
          slug: config.slug,
          env: config.envVariables,
        }),
      });

      if (!res.ok) {
        throw new Error(`API responded with status: ${res.status}`);
      }

      const data = await res.json();
      const deployedSlug = data.data?.projectSlug || config.slug;

      setActiveDeployment({
        slug: deployedSlug,
        gitURL: config.gitURL,
      });

      setCurrentView('logs');
    } catch (err: any) {
      console.error('Deployment error:', err);
      alert(`Deployment Failed to Trigger:\n${err.message}\n\nPlease make sure api-server is running and restarted!`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Navigation */}
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={() => setUser(null)}
      />

      {/* Main Content Area with generous breathing space */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {currentView === 'repos' && (
          <RepoList
            user={user}
            onSelectRepo={handleSelectRepo}
            onCustomGitUrl={(url) => {
              handleSelectRepo({
                name: 'custom-repo',
                fullName: 'custom/repo',
                gitUrl: url,
                defaultBranch: 'main',
                updatedAt: 'Just now',
              });
            }}
          />
        )}

        {currentView === 'config' && selectedRepo && (
          <ProjectConfigModal
            repo={selectedRepo}
            onBack={() => setCurrentView('repos')}
            onDeploy={handleDeploy}
          />
        )}

        {currentView === 'logs' && activeDeployment && (
          <DeploymentLogs
            slug={activeDeployment.slug}
            gitURL={activeDeployment.gitURL}
            onDeployAnother={() => {
              setActiveDeployment(null);
              setSelectedRepo(null);
              setCurrentView('repos');
            }}
          />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onDemoLogin={(newUser) => setUser(newUser)}
      />

      {/* Subtle Footer */}
      <footer className="w-full border-t border-slate-200/80 py-6 mt-auto bg-white/50 text-xs text-slate-400 text-center">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>CloudDeploy — Powered by AWS ECS Fargate, S3 & Redis</span>
          <div className="flex items-center gap-4 text-slate-500">
            <span>API Server: 9000</span>
            <span>Logs Socket: 9002</span>
            <span>S3 Reverse Proxy: 8000</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
