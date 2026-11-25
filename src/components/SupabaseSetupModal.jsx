import React, { useState, useEffect } from 'react';
import { Database, Check, Copy, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { checkSupabaseHealth } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';
import {
  BRANCH_ACCESS_MIGRATION_SQL,
  LOGIN_ACCOUNTS_SQL,
  MEMBERSHIP_PLANS_SQL,
  MASTER_SCHEMA_SQL,
  RENAME_BRANCHES_SQL,
  BRANCH_MANAGER_LOGIN_SQL
} from '../services/schemaSql.js';

export default function SupabaseSetupModal({ isOpen, onClose }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fxtmyfhmqwyvzsgzatjq.supabase.co';
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'fxtmyfhmqwyvzsgzatjq';

  useEffect(() => {
    if (isOpen) {
      loadHealth();
    }
  }, [isOpen]);

  async function loadHealth() {
    setChecking(true);
    const res = await checkSupabaseHealth(true);
    setHealth(res);
    setChecking(false);
  }

  async function handleCopySQL(sql) {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      toast('SQL script copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not copy SQL to clipboard.', 'error');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content setup-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Database size={24} color="#10b981" />
            </div>
            <div>
              <h2>Supabase Cloud Database Setup</h2>
              <p>Magic Meat Cloud Multi-Branch Integration</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {/* Status banner */}
          <div className={`status-card ${health?.tablesExist ? 'status-card-success' : 'status-card-warning'}`}>
            <div className="status-card-left">
              {health?.tablesExist ? (
                <CheckCircle2 size={24} className="text-emerald" />
              ) : (
                <AlertTriangle size={24} className="text-amber" />
              )}
              <div>
                <strong>
                  {health?.tablesExist
                    ? 'Supabase Database is 100% Active & Ready!'
                    : 'Schema Migration Required in Supabase'}
                </strong>
                <p>
                  {health?.tablesExist
                    ? 'All tables (branches, products, inventory, sales) and RPC checkout functions are running live in Supabase Cloud.'
                    : 'Your Supabase project is connected, but the SQL tables have not been created yet. Run the SQL script below to activate live sync!'}
                </p>
              </div>
            </div>
            <button className="btn-secondary btn-sm" onClick={loadHealth} disabled={checking}>
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking...' : 'Recheck Status'}
            </button>
          </div>

          {/* Connection Details */}
          <div className="setup-meta-grid">
            <div className="meta-box">
              <span className="meta-label">Supabase Project URL</span>
              <span className="meta-value font-mono">{supabaseUrl}</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">Project ID</span>
              <span className="meta-value font-mono">{projectRef}</span>
            </div>
            <div className="meta-box">
              <span className="meta-label">Current App State</span>
              <span className="meta-value">
                {health?.tablesExist ? (
                  <span className="badge-pill pill-green">🟢 Live Cloud Database</span>
                ) : (
                  <span className="badge-pill pill-amber">🟡 Local / Fallback Ready (Zero Downtime)</span>
                )}
              </span>
            </div>
          </div>

          {/* Step-by-step Guide */}
          <div className="setup-steps">
            <h3>🚀 Supabase, Branch Login & Names:</h3>
            <ol className="step-list">
              <li>
                <div className="step-content">
                  <strong>{health?.tablesExist ? 'Step 1: Apply Branch Access Rules' : 'Step 1: Copy Master SQL Schema'}</strong>
                  <p>
                    {health?.tablesExist
                      ? 'This safe migration restricts staff to their assigned branch and does not reset inventory. Run it once in the SQL Editor.'
                      : 'Copy the full schema to create tables, secure branch access, checkout procedures, and sample branch/product data.'}
                  </p>
                  <button
                    className="btn-primary btn-sm mt-2"
                    onClick={() => handleCopySQL(health?.tablesExist ? BRANCH_ACCESS_MIGRATION_SQL : MASTER_SCHEMA_SQL)}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied to Clipboard!' : health?.tablesExist ? 'Copy Branch Access Migration' : 'Copy Entire SQL Script (schema.sql)'}
                  </button>
                </div>
              </li>
              <li>
                <div className="step-content">
                  <strong>Membership Plan Management migration</strong>
                  <p>
                    Run this after the main schema is installed to create plans and customer/delivery tables, seed the five default plans, and apply owner and branch-scoped access policies. Branch users can enroll customers only in plans assigned to their branch. Memberships complete after 3 deliveries or plan expiry; cancellation has no refund.
                  </p>
                  <button className="btn-primary btn-sm mt-2" onClick={() => handleCopySQL(MEMBERSHIP_PLANS_SQL)}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied to Clipboard!' : 'Copy Membership Plans SQL'}
                  </button>
                </div>
              </li>
              <li>
                <div className="step-content">
                  <strong>Step 2: Paste in Supabase SQL Editor & Click "RUN"</strong>
                  <p>Open your Supabase dashboard SQL editor for this project and click RUN (takes ~3 seconds).</p>
                  <a
                    href={`https://supabase.com/dashboard/project/${projectRef}/sql/new`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline btn-sm mt-2 inline-flex"
                  >
                    <ExternalLink size={14} /> Open Supabase SQL Editor in New Tab
                  </a>
                </div>
              </li>
              <li>
                <div className="step-content">
                  <strong>Rename existing branches</strong>
                  <p>Run this once to rename existing branch records to Chennai, Trichy, and Tirunelveli without deleting sales or stock.</p>
                  <button className="btn-secondary btn-sm mt-2" onClick={() => handleCopySQL(RENAME_BRANCHES_SQL)}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied to Clipboard!' : 'Copy Branch Rename SQL'}
                  </button>
                </div>
              </li>
              <li>
                <div className="step-content">
                  <strong>Step 3: Set up the Admin account</strong>
                  <p>
                    Create or use the confirmed `admin@gmail.com` user for Admin. Set its password to the owner's Admin password. Branch manager accounts are created from the Outlets form after the Edge Function below is deployed.
                  </p>
                  <a
                    href={`https://supabase.com/dashboard/project/${projectRef}/auth/users`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline btn-sm mt-2 inline-flex"
                  >
                    <ExternalLink size={14} /> Open Supabase Auth Users
                  </a>
                  <p className="mt-2">Then run this SQL to assign the Admin profile and any legacy branch accounts you already have:</p>
                  <button className="btn-primary btn-sm mt-2" onClick={() => handleCopySQL(LOGIN_ACCOUNTS_SQL)}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied to Clipboard!' : 'Copy Login Accounts SQL'}
                  </button>
                </div>
              </li>
              <li>
                <div className="step-content">
                  <strong>Step 4: Click "Recheck Status" Above</strong>
                  <p>Once you click Run in Supabase, click "Recheck Status" above. The software will instantly switch to live Supabase Cloud database!</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="setup-section">
            <h3>Branch manager passwords</h3>
            <p>Run this SQL once for an existing database, then deploy the Edge Function from the project folder with the Supabase CLI:</p>
            <button className="btn-secondary btn-sm mt-2" onClick={() => handleCopySQL(BRANCH_MANAGER_LOGIN_SQL)}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Branch Login SQL'}
            </button>
            <pre className="setup-command">supabase functions deploy manage-branch-login --project-ref {projectRef}</pre>
            <p>The function uses the project’s Supabase service role secret on the server. Never add that key to the frontend environment.</p>
          </div>

          <div className="setup-callout">
            <ShieldCheck size={20} color="#10b981" />
            <div>
              <strong>Resilient Fallback Mode Active</strong>
              <p>Demo accounts use sample data stored only on this device. Use assigned Supabase accounts for live, branch-restricted data.</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
