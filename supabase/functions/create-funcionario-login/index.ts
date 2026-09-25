import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateFuncionarioLoginRequest {
  funcionario_id: string;
  email: string;
  password?: string;
}

function validateInput(input: CreateFuncionarioLoginRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.funcionario_id || typeof input.funcionario_id !== 'string') {
    errors.push('funcionario_id é obrigatório');
  }

  if (!input.email || typeof input.email !== 'string') {
    errors.push('Email é obrigatório');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      errors.push('Email inválido');
    }
    if (input.email.length > 255) {
      errors.push('Email muito longo (máximo 255 caracteres)');
    }
  }

  if (input.password !== undefined) {
    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
      errors.push('Senha deve ter entre 8 e 128 caracteres');
    }
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client com o token do chamador, só para resolver identidade
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client com service role para as escritas privilegiadas (criar usuário Auth)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const body: CreateFuncionarioLoginRequest = await req.json()
    const validation = validateInput(body)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.errors.join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: funcionario, error: funcionarioError } = await supabaseAdmin
      .from('funcionarios')
      .select('id, user_id, ativo, auth_user_id')
      .eq('id', body.funcionario_id)
      .maybeSingle()

    if (funcionarioError || !funcionario) {
      return new Response(
        JSON.stringify({ error: 'Funcionário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Autorização: precisa ser o gestor dono deste funcionário, ou super admin -
    // diferente de admin-create-user (que exige super admin sempre), aqui é
    // "o gestor responsável por este funcionário" quem decide.
    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle()

    const isOwner = funcionario.user_id === user.id
    const isSuperAdmin = callerRole?.is_super_admin === true

    if (!isOwner && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas o gestor responsável por este funcionário pode criar o acesso.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!funcionario.ativo) {
      return new Response(
        JSON.stringify({ error: 'Não é possível criar acesso para um funcionário inativo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (funcionario.auth_user_id) {
      return new Response(
        JSON.stringify({ error: 'Este funcionário já possui um acesso criado' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let authUserId: string;

    if (body.password) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
      })

      if (authError || !authData.user) {
        if (authError?.message?.includes('already registered')) {
          return new Response(
            JSON.stringify({ error: 'Este email já está registrado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        throw authError ?? new Error('Falha ao criar usuário')
      }
      authUserId = authData.user.id
    } else {
      // Sem senha informada: convida o funcionário por email a definir a própria senha.
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        body.email.trim()
      )

      if (inviteError || !inviteData.user) {
        if (inviteError?.message?.includes('already registered')) {
          return new Response(
            JSON.stringify({ error: 'Este email já está registrado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        throw inviteError ?? new Error('Falha ao convidar usuário')
      }
      authUserId = inviteData.user.id
    }

    const { error: updateError } = await supabaseAdmin
      .from('funcionarios')
      .update({ auth_user_id: authUserId })
      .eq('id', body.funcionario_id)

    if (updateError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      throw updateError
    }

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUserId,
        role: 'funcionario',
      })

    if (roleInsertError) {
      // Não desfaz o vínculo já criado: o papel pode ser corrigido manualmente.
      // Sem ele, o funcionário só perde a navegação restrita automática no
      // frontend - os dados de ponto continuam protegidos por is_own_funcionario().
      console.error('Error inserting funcionario role:', roleInsertError)
    }

    await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'create_funcionario_login',
        resource_type: 'funcionario',
        resource_id: body.funcionario_id,
        new_data: { email: body.email, auth_user_id: authUserId }
      })

    return new Response(
      JSON.stringify({
        success: true,
        funcionario_id: body.funcionario_id,
        auth_user_id: authUserId,
        email: body.email,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
