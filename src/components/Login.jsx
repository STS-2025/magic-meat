import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Store, Eye, EyeOff } from 'lucide-react';
import { supabase, isConfigured, fetchLoginBranches } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';

const ADMIN_ACCOUNT = 'admin@gmail.com';

export default function Login({ authNotice, onLogout }) {
  const toast = useToast();
  const [account, setAccount] = useState('admin');
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authNotice) {
      toast(authNotice, 'error');
    }
  }, [authNotice, toast]);

  useEffect(() => {
    let active = true;

    async function loadBranches() {
      setBranchesLoading(true);
      const result = await fetchLoginBranches();
      if (!active) return;

      const availableBranches = (result.data || []).filter(branch => branch.is_active !== false);
      setBranches(availableBranches);
      setBranchesLoading(false);

      if (account !== 'admin' && !availableBranches.some(branch => branch.code === account)) {
        setAccount('admin');
      }
    }

    loadBranches();
    return () => { active = false; };
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isConfigured || !supabase) {
      const msg = 'Login service is temporarily unavailable. Please try again later.';
      setError(msg);
      toast(msg, 'error');
      setLoading(false);
      return;
    }

    try {
      let email = ADMIN_ACCOUNT;

      if (account !== 'admin') {
        const { data, error: branchError } = await supabase.rpc('get_branch_login_email', {
          p_branch_code: account
        });

        if (branchError || !data) {
          const msg = 'This branch account is unavailable. Please contact the administrator.';
          setError(msg);
          toast(msg, 'error');
          setLoading(false);
          return;
        }

        email = data;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        const message = error.message?.toLowerCase() || '';
        let userMsg = 'Something went wrong. Please try again later.';

        if (
          message.includes('invalid login credentials') ||
          message.includes('user not found')
        ) {
          userMsg = 'Unable to sign in. Please check your login details and try again.';
        } else if (message.includes('email not confirmed')) {
          userMsg = 'Your account is not yet activated. Please contact the administrator.';
        } else if (
          message.includes('network') ||
          message.includes('fetch')
        ) {
          userMsg = 'Connection problem. Please check your internet and try again.';
        }

        setError(userMsg);
        toast(userMsg, 'error');
        return;
      }

      toast('Welcome back! Signed in successfully.');
    } catch (err) {
      const msg = 'Unable to complete your request. Please try again later.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Brand Banner */}
        <div className="auth-brand">
          <img className="auth-logo-icon" src="/magic-meat-logo.png" alt="MAGIC MEAT logo" />
          <h1>MAGIC MEAT</h1>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-field">
            <label htmlFor="login-account">Branch / Admin</label>
            <div className="input-wrap">
              <Store size={16} className="field-icon" />
              <select
                id="login-account"
                value={account}
                disabled={branchesLoading}
                onChange={e => {
                  setAccount(e.target.value);
                  setPassword('');
                  setError('');
                }}
              >
                <option value="admin">Admin</option>
                {branches.map(branch => (
                  <option key={branch.id || branch.code} value={branch.code}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-field">
            <label htmlFor="login-password">Password</label>
            <div className="input-wrap password-input-wrap">
              <Lock size={16} className="field-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(visible => !visible)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading || branchesLoading}>
            {loading ? 'Signing in...' : 'Open account'}
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="auth-tagline">Each account only opens its assigned branch. Ask the owner to set up your password.</p>
      </div>
    </div>
  );
}
