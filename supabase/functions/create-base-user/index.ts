import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return response({ error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !serviceRoleKey || !authorization) {
    return response({ error: 'Configuración de autenticación incompleta.' }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
    global: { headers: { Authorization: authorization } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(authorization.replace('Bearer ', ''));
  if (callerError || !caller) return response({ error: 'Sesión no válida.' }, 401);

  const { data: callerProfile } = await adminClient
    .from('app_profiles')
    .select('role_id, app_roles(name)')
    .eq('id', caller.id)
    .single();
  const { data: callerPermissions } = await adminClient
    .from('app_role_permissions')
    .select('permission_key, can_edit')
    .eq('role_id', callerProfile?.role_id || '00000000-0000-0000-0000-000000000000');
  const canManageUsers = callerProfile?.app_roles?.name === 'Administrador' || (callerPermissions || []).some(
    (permission: { permission_key: string; can_edit: boolean }) => permission.permission_key === 'users' && permission.can_edit
  );
  if (!canManageUsers) return response({ error: 'No tiene permiso para crear usuarios.' }, 403);

  const payload = await request.json();
  const action = payload.action || 'create';
  if (action === 'list') {
    const { data: profiles, error: profilesError } = await adminClient
      .from('app_profiles')
      .select('id, email, username, account_type, role_id, created_at')
      .order('created_at', { ascending: true });
    if (profilesError) return response({ error: profilesError.message }, 400);
    const { data: authUsers, error: authUsersError } = await adminClient.auth.admin.listUsers({ perPage: 1000, page: 1 });
    if (authUsersError) return response({ error: authUsersError.message }, 400);
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const users = (authUsers.users || []).map((user) => profileById.get(user.id) || {
      id: user.id,
      email: user.email || '',
      username: user.user_metadata?.username || '',
      account_type: user.user_metadata?.account_type || 'base',
      role_id: null,
      created_at: user.created_at
    });
    return response({ users });
  }

  const { username, password, role_id: roleId, user_id: userId } = payload;
  if (action === 'update_role') {
    if (!userId || !roleId) return response({ error: 'Faltan el usuario o el rol.' }, 400);
    const { data: target } = await adminClient.auth.admin.getUserById(userId);
    const { error } = await adminClient.from('app_profiles').upsert({
      id: userId,
      email: target.user?.email || '',
      username: target.user?.user_metadata?.username || null,
      account_type: target.user?.user_metadata?.account_type || 'base',
      role_id: roleId
    });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }

  if (action === 'delete') {
    if (!userId || userId === caller.id) return response({ error: 'No puede eliminar su propio usuario.' }, 400);
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }

  if (action === 'reset_password') {
    if (!userId || String(password || '').length < 6) return response({ error: 'La clave debe tener al menos 6 caracteres.' }, 400);
    const { error } = await adminClient.auth.admin.updateUserById(userId, { password: String(password) });
    return error ? response({ error: error.message }, 400) : response({ ok: true });
  }

  if (!/^[a-z0-9._-]{3,40}$/.test(String(username || ''))) {
    return response({ error: 'El usuario debe tener entre 3 y 40 caracteres válidos.' }, 400);
  }
  if (String(password || '').length < 6) return response({ error: 'La clave debe tener al menos 6 caracteres.' }, 400);

  const email = `${String(username).toLowerCase()}@usuarios.consentimiento.app`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: String(username).toLowerCase(), account_type: 'base' }
  });
  if (createError || !created.user) return response({ error: createError?.message || 'No se pudo crear el usuario.' }, 400);

  const { error: profileError } = await adminClient.from('app_profiles').upsert({
    id: created.user.id,
    email,
    username: String(username).toLowerCase(),
    account_type: 'base',
    role_id: roleId
  });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return response({ error: `No se pudo asignar el rol: ${profileError.message}` }, 400);
  }

    return response({ user: { id: created.user.id, username: String(username).toLowerCase() } }, 201);
  } catch (error) {
    console.error('create-base-user error', error);
    return response({ error: error instanceof Error ? error.message : 'Error interno al crear el usuario.' }, 500);
  }
});
