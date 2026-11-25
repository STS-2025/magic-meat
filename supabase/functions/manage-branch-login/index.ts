import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);

function resolveDefaultKey(value: string | undefined) {
  if (!value) return undefined;
  try {
    const keys = JSON.parse(value);
    if (typeof keys === 'string') return keys;
    if (keys && typeof keys === 'object') {
      return keys.default || Object.values(keys).find(key => typeof key === 'string');
    }
  } catch {
    return value;
  }
  return undefined;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || resolveDefaultKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || resolveDefaultKey(Deno.env.get('SUPABASE_SECRET_KEYS'));
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ success: false, error: 'Branch login service is not configured.' }, 500);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ success: false, error: 'Sign in as the owner to manage branch logins.' }, 401);

    const { data: owner, error: ownerError } = await callerClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();
    if (ownerError) {
      console.error('Could not read caller profile:', ownerError.message);
      return json({ success: false, error: 'Could not verify the signed-in owner profile.' }, 500);
    }
    if (owner?.role !== 'owner' || owner.is_active === false) {
      return json({ success: false, error: 'Only an active owner can manage branch logins.' }, 403);
    }

    const body = await request.json();
    const branchId = typeof body.branchId === 'string' ? body.branchId : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    if (!branchId) return json({ success: false, error: 'Select a branch first.' }, 400);
    if (password.length < 8) return json({ success: false, error: 'Password must be at least 8 characters.' }, 400);

    // The owner just edited this branch through the same authenticated client.
    // Read it with that owner session so branch lookup follows the same RLS
    // permissions. Keep the service key only for Auth Admin operations.
    const { data: branch, error: branchError } = await callerClient
      .from('branches')
      .select('id, code, name')
      .eq('id', branchId)
      .maybeSingle();
    if (branchError) {
      console.error('Could not look up branch:', branchError.message);
      return json({ success: false, error: 'Could not look up the branch in Supabase. Check the function logs.' }, 500);
    }
    if (!branch) {
      return json({
        success: false,
        error: 'This branch is not in the Supabase database used by the function. Refresh the branch list and try again.'
      }, 404);
    }

    const { data: existingProfiles, error: profileError } = await callerClient
      .from('profiles')
      .select('id, role')
      .eq('branch_id', branch.id)
      .eq('is_active', true)
      .in('role', ['manager', 'cashier'])
      .order('role', { ascending: true });
    if (profileError) return json({ success: false, error: 'Could not check the branch account.' }, 500);

    const existingProfile = existingProfiles?.find(profile => profile.role === 'manager') || existingProfiles?.[0];
    const displayName = fullName || branch.name;
    if (existingProfile) {
      const { error: userUpdateError } = await adminClient.auth.admin.updateUserById(existingProfile.id, {
        password,
        user_metadata: { full_name: displayName, role: 'manager', branch_id: branch.id }
      });
      if (userUpdateError) return json({ success: false, error: userUpdateError.message }, 400);

      const { error: updateProfileError } = await callerClient
        .from('profiles')
        .update({ full_name: displayName, role: 'manager' })
        .eq('id', existingProfile.id);
      if (updateProfileError) return json({ success: false, error: updateProfileError.message }, 500);
      return json({ success: true, updated: true });
    }

    const accountCode = branch.code.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const email = `magicmeat.${accountCode}@example.com`;
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, role: 'manager', branch_id: branch.id }
    });
    if (createError || !created.user) {
      return json({
        success: false,
        error: createError?.message || 'Could not create the branch manager account.'
      }, 400);
    }

    const { error: insertProfileError } = await callerClient.from('profiles').insert({
      id: created.user.id,
      full_name: displayName,
      role: 'manager',
      branch_id: branch.id,
      is_active: true
    });
    if (insertProfileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ success: false, error: insertProfileError.message }, 500);
    }

    return json({ success: true, updated: false });
  } catch (error) {
    console.error('manage-branch-login failed:', error);
    return json({ success: false, error: 'Could not save the branch manager login.' }, 500);
  }
});
