import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Store,
  ShoppingCart,
  TrendingUp,
  Package,
  Layers,
  Database,
  LogOut,
  BadgePercent,
  Users,
  Settings as SettingsIcon,
  Menu,
  X
} from 'lucide-react';

export default function Navbar({
  profile,
  activeBranch,
  branches,
  onSelectBranch,
  onOpenSetup,
  health,
  onLogout
}) {
  const isOwner = profile?.role === 'owner';
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <>
      <div
        className={`mobile-nav-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      <button
        type="button"
        className={`mobile-nav-toggle no-print ${mobileOpen ? 'mobile-open' : ''}`}
        onClick={() => setMobileOpen((open) => !open)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <header className={`main-nav-header no-print ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="nav-left">
          <NavLink to="/" className="nav-brand" onClick={closeMobileMenu}>
            <img className="brand-meat-icon" src="/magic-meat-logo.png" alt="MAGIC MEAT logo" />
            <div className="brand-text">
              <span className="brand-title">MAGIC MEAT</span>
              <span className="brand-sub">CLOUD BUTCHERY POS</span>
            </div>
          </NavLink>

          <div className="active-counter-pill">
            <Store size={14} className="text-emerald" />
            <span className="counter-name">{activeBranch?.name || 'Counter'}</span>
            <span className="counter-code">{activeBranch?.code}</span>
          </div>
        </div>

        <nav className="nav-center-links">
          {!isOwner && (
            <>
              <NavLink
                to="/history"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <TrendingUp size={16} />
                <span>Branch Dashboard</span>
              </NavLink>

              <NavLink
                to="/billing"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <ShoppingCart size={16} />
                <span>Billing Counter</span>
              </NavLink>

              <NavLink
                to="/membership"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Users size={16} />
                <span>Membership Management</span>
              </NavLink>
            </>
          )}

          {isOwner && (
            <>
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <TrendingUp size={16} />
                <span>Owner Dashboard</span>
              </NavLink>

              <NavLink
                to="/billing"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <ShoppingCart size={16} />
                <span>Billing Counter</span>
              </NavLink>

              <NavLink
                to="/products"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Package size={16} />
                <span>Meat Catalogue</span>
              </NavLink>

              <NavLink
                to="/inventory"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Layers size={16} />
                <span>Stock Matrix</span>
              </NavLink>

              <NavLink
                to="/branches"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Store size={16} />
                <span>Outlets</span>
              </NavLink>

              <NavLink
                to="/membership"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <BadgePercent size={16} />
                <span>Membership Management</span>
              </NavLink>

              <NavLink
                to="/settings"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <SettingsIcon size={16} />
                <span>Settings</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="nav-right">
          <button
            className={`supabase-status-pill ${
              health?.tablesExist ? 'status-pill-live' : 'status-pill-pending'
            }`}
            onClick={() => {
              onOpenSetup();
              closeMobileMenu();
            }}
            title="Click to check Supabase Cloud Database status or copy SQL"
          >
            <Database size={14} />
            <span>{health?.tablesExist ? 'Billing is Live' : 'Supabase SQL Setup'}</span>
            <span className="pulse-indicator"></span>
          </button>

          <div className="nav-account-row">
            <div className="user-profile-badge">
              <div className="role-tag">
                {isOwner ? '👑 Owner' : '💼 Cashier'}
              </div>
              <span className="user-name">{profile?.full_name || 'Staff User'}</span>
            </div>

            <button className="btn-logout" onClick={onLogout} title="Sign Out" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
