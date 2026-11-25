import React, { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { supabase, isConfigured } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';

export default function Settings() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  async function changePassword(event) {
    event.preventDefault();
    if (saving) return;
    if (!isConfigured || !supabase) {
      toast('Connect Supabase to change the admin password.', 'error');
      return;
    }
    if (form.newPassword.length < 8) {
      toast('New password must be at least 8 characters.', 'error');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast('New passwords do not match.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error('Could not verify the signed-in admin account.');

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: form.currentPassword
      });
      if (verifyError) throw new Error('Current password is incorrect.');

      const { error: updateError } = await supabase.auth.updateUser({ password: form.newPassword });
      if (updateError) throw updateError;

      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Admin password changed successfully.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not change the admin password.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-container settings-page">
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-subtitle">Manage your administrator account security</p>
        </div>
      </div>

      <section className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon"><KeyRound size={20} /></span>
          <div>
            <h2>Change admin password</h2>
            <p>Confirm your current password before saving a new one.</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={changePassword}>
          <div className="form-group">
            <label htmlFor="current-admin-password">Current password</label>
            <input
              id="current-admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={event => setForm({ ...form, currentPassword: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-admin-password">New password</label>
            <input
              id="new-admin-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.newPassword}
              onChange={event => setForm({ ...form, newPassword: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-admin-password">Confirm new password</label>
            <input
              id="confirm-admin-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.confirmPassword}
              onChange={event => setForm({ ...form, confirmPassword: event.target.value })}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}
