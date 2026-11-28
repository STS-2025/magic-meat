import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase, isConfigured, checkSupabaseHealth, fetchBranches } from './services/supabase.js';
import Navbar from './components/Navbar.jsx';
import Billing, { resetBillingDraftCache } from './components/Billing.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import ProductManager from './components/ProductManager.jsx';
import InventoryManager from './components/InventoryManager.jsx';
import BranchManager from './components/BranchManager.jsx';
import MembershipManagement from './components/MembershipManagement.jsx';
import BranchMembership from './components/BranchMembership.jsx';
import SupabaseSetupModal from './components/SupabaseSetupModal.jsx';
import Login from './components/Login.jsx';
import Settings from './components/Settings.jsx';
import { useToast } from './components/ToastProvider.jsx';

export default function App() {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileCheckComplete, setProfileCheckComplete] = useState(false);
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const navigate = useNavigate();

  // 1. Initial health check & branch loader
  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (!profile || profile.role === 'owner' || !profile.branch_id) return;
    const assignedBranch = branches.find(branch => branch.id === profile.branch_id);
    if (assignedBranch) setActiveBranch(assignedBranch);
  }, [profile, branches]);

  async function initApp() {
    setLoading(true);
    const [healthRes, branchRes] = await Promise.all([
      checkSupabaseHealth(),
      fetchBranches()
    ]);
    setHealth(healthRes);
    const bList = branchRes.data || [];
    setBranches(bList);
    if (bList.length > 0 && !activeBranch) {
      setActiveBranch(bList[0]);
    }
    setLoading(false);
  }

  // 2. Supabase Auth listener
  useEffect(() => {
    if (!isConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSession(data.session);
        fetchProfile(data.session.user);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user);
      } else {
        resetBillingDraftCache();
        setProfile(null);
        localStorage.removeItem('magicmeat_active_profile');
        setBranches([]);
        setActiveBranch(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // A sleeping Supabase project can reject the first profile request after sign-in.
  // Keep checking while that authenticated session has no profile, then reload the
  // app data once the database responds so the user does not need to refresh.
  useEffect(() => {
    const user = session?.user;
    const databaseUnavailable = health?.status === 'offline' || health?.status === 'error';
    if (!user || !profileCheckComplete || !databaseUnavailable) return;

    let active = true;
    let timeoutId;

    async function checkForDatabase() {
      const healthResult = await checkSupabaseHealth(true);
      if (!active) return;

      setHealth(healthResult);
      if (healthResult.status === 'live') {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.id === user.id) window.location.reload();
        return;
      }

      timeoutId = setTimeout(checkForDatabase, 5000);
    }

    timeoutId = setTimeout(checkForDatabase, 5000);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [session?.user?.id, profileCheckComplete, health?.status]);

  async function fetchProfile(user) {
    if (!user) return;
    setProfileCheckComplete(false);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        console.error('Signed-in user has no active branch access profile:', error);
        setProfile(null);
        localStorage.removeItem('magicmeat_active_profile');
        return;
      }

      setProfile(data);
      localStorage.setItem('magicmeat_active_profile', JSON.stringify(data));
      const branchRes = await fetchBranches();
      const availableBranches = branchRes.data || [];
      const visibleBranches = data.role === 'owner'
        ? availableBranches
        : availableBranches.filter(branch => branch.id === data.branch_id);
      setBranches(visibleBranches);
      if (data.role !== 'owner' && visibleBranches[0]) {
        setActiveBranch(visibleBranches[0]);
      }
      // Direct sign-in navigation: Owner to Owner Dashboard, Branch to Branch Dashboard
    } catch (e) {
      console.warn('Error fetching profile:', e);
      setProfile(null);
      localStorage.removeItem('magicmeat_active_profile');
    } finally {
      setProfileCheckComplete(true);
    }
  }

  function handleLogout() {
    resetBillingDraftCache();
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    setSession(null);
    setProfile(null);
    localStorage.removeItem('magicmeat_active_profile');
    toast('Signed out successfully.');
    navigate('/');
  }

  // Reload branches
  async function reloadBranches() {
    const res = await fetchBranches();
    if (res.data) {
      setBranches(res.data);
    }
  }

  if (loading) {
    return (
      <div className="app-loading-screen">
        <img className="loading-meat-pulse" src="/magic-meat-logo.png" alt="" />
        <h2>MAGIC MEAT CLOUD</h2>
        <p>Connecting butchery pos & branch inventory...</p>
      </div>
    );
  }

  if (
    session &&
    !profile &&
    profileCheckComplete &&
    (health?.status === 'offline' || health?.status === 'error')
  ) {
    return (
      <div className="app-loading-screen" role="status" aria-live="polite">
        <img className="loading-meat-pulse" src="/magic-meat-logo.png" alt="" />
        <h2>Waking up the database...</h2>
        <p>Your account is signed in. We’ll load your data automatically when the connection is ready.</p>
      </div>
    );
  }

  // If not logged in, show high-end Login screen
  if (!profile) {
    return (
      <>
        <Login
          authNotice={session && profileCheckComplete ? 'This account does not have an active access profile. Ask the owner to assign your role and branch.' : ''}
          onLogout={handleLogout}
        />
        <SupabaseSetupModal
          isOpen={setupModalOpen}
          onClose={() => {
            setSetupModalOpen(false);
            initApp();
          }}
        />
      </>
    );
  }

  const isOwner = profile?.role === 'owner';

  return (
    <div className="app-layout">
      {/* Top Main Navigation Header */}
      <Navbar
        profile={profile}
        activeBranch={activeBranch}
        branches={branches}
        onSelectBranch={setActiveBranch}
        onOpenSetup={() => setSetupModalOpen(true)}
        health={health}
        onLogout={handleLogout}
      />

      {/* Main Content Router */}
      <main className="main-content-area">
        <Routes>
          <Route
            path="/"
            element={<Navigate to={isOwner ? '/admin' : '/history'} replace />}
          />
          <Route
            path="/history"
            element={
              profile?.role === 'owner'
                ? <Navigate to="/admin" replace />
                : <AdminDashboard branches={branches} profile={profile} branch={activeBranch} />
            }
          />
          <Route
            path="/billing"
            element={
              <Billing
                profile={profile}
                activeBranch={activeBranch}
                branches={branches}
                onSelectBranch={setActiveBranch}
              />
            }
          />
          <Route
            path="/admin"
            element={
              isOwner ? (
                <AdminDashboard branches={branches} profile={profile} />
              ) : (
                <Navigate to="/history" replace />
              )
            }
          />
          <Route
            path="/products"
            element={
              isOwner ? (
                <ProductManager branches={branches} activeBranch={activeBranch} />
              ) : (
                <Navigate to="/history" replace />
              )
            }
          />
          <Route
            path="/inventory"
            element={<InventoryManager branches={branches} lockedBranchId={isOwner ? null : activeBranch?.id} />}
          />
          <Route
            path="/branches"
            element={
              isOwner ? (
                <BranchManager
                  branches={branches}
                  onBranchAdded={reloadBranches}
                />
              ) : (
                <Navigate to="/history" replace />
              )
            }
          />
          <Route
            path="/membership"
            element={
              isOwner
                ? <MembershipManagement branches={branches} />
                : <BranchMembership branch={activeBranch} />
            }
          />
          <Route
            path="/settings"
            element={isOwner ? <Settings /> : <Navigate to="/history" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Supabase Migration & Setup Modal */}
      <SupabaseSetupModal
        isOpen={setupModalOpen}
        onClose={() => {
          setSetupModalOpen(false);
          initApp();
        }}
      />
    </div>
  );
}
