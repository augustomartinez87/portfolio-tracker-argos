import { supabase } from '@/lib/supabase';

export const userService = {
  // ============================================================================
  // Funciones para usuarios autenticados
  // ============================================================================

  /**
   * Crear perfil para un usuario si no existe
   * @param {string} userId - ID del usuario de Supabase
   */
  async createProfileIfNotExists(userId) {
    if (!userId) return null;

    try {
      console.log(`[UserService] Creating profile for user ${userId}`);
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          role: 'user',
          modules: ['portfolio', 'carryTrade'],
          is_active: true
        })
        .select()
        .single();

      if (error) {
        // Si ya existe (violación de unique constraint), intentar obtenerlo
        if (error.code === '23505') {
          console.log(`[UserService] Profile already exists for user ${userId}`);
          return this.getProfile(userId);
        }
        console.error('[UserService] Error creating profile:', error);
        return null;
      }

      console.log(`[UserService] Profile created successfully for user ${userId}`);
      return data;
    } catch (err) {
      console.error('[UserService] Error in createProfileIfNotExists:', err);
      return null;
    }
  },

  /**
   * Obtener perfil de un usuario específico
   * @param {string} userId - ID del usuario de Supabase
   */
  async getProfile(userId) {
    if (!userId) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Reducido a 8s

    try {
      console.log(`[UserService] Fetching profile for user ${userId}`);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeoutId);

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[UserService] No profile found for user ${userId}, creating one...`);
          // Intentar crear el perfil automáticamente
          return this.createProfileIfNotExists(userId);
        }
        console.error('[UserService] Error fetching profile:', error);
        throw error; // Propagar error para retry mechanism
      }
      console.log(`[UserService] Profile loaded successfully for user ${userId}`);
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`[UserService] Profile fetch timeout for user ${userId}`);
        throw new Error('Profile fetch timeout');
      }
      console.error('[UserService] Profile fetch failed:', err);
      throw err; // Propagar error para retry mechanism
    }
  },

  /**
   * Obtener perfil con retry exponencial
   * @param {string} userId - ID del usuario de Supabase
   * @param {number} retries - Número de intentos
   */
  async getProfileWithRetry(userId, retries = 3) {
    let lastError = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const profile = await this.getProfile(userId);
        return profile;
      } catch (err) {
        lastError = err;
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`[UserService] Retry attempt ${attempt + 1} for user ${userId} in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[UserService] All retries failed for user ${userId}:`, lastError);
    throw lastError;
  },

  /**
   * Obtener perfil del usuario actual (legacy, prefiere getProfile)
   */
  async getCurrentProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return this.getProfile(user.id);
  },

  /**
   * Verificar si el usuario actual es admin
   */
  async isAdmin() {
    const profile = await this.getCurrentProfile();
    return profile?.role === 'admin';
  },

  /**
   * Obtener módulos permitidos del usuario actual
   */
  async getAllowedModules() {
    const profile = await this.getCurrentProfile();
    return profile?.modules || ['portfolio', 'carryTrade'];
  },

  /**
   * Registrar actividad del usuario
   */
  async logActivity(action, module = null, details = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.from('user_activity').insert({
        user_id: user.id,
        action,
        module,
        details
      });
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  },

  // ============================================================================
  // Funciones solo para administradores
  // ============================================================================

  /**
   * Listar todos los usuarios (admin only)
   */
  async getAllUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
          *,
          user:user_id (
            email,
            created_at,
            last_sign_in_at
          )
        `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    // Transformar datos para incluir email directamente
    return data.map(profile => ({
      ...profile,
      email: profile.user?.email,
      last_sign_in: profile.user?.last_sign_in_at,
      user_created_at: profile.user?.created_at
    }));
  },

  /**
   * Actualizar rol de un usuario (admin only)
   */
  async updateUserRole(userId, role) {
    // Actualizar módulos según el rol
    const modules = role === 'admin'
      ? ['portfolio', 'fci', 'carryTrade', 'financiacion', 'funding', 'analisis', 'admin']
      : ['portfolio', 'carryTrade'];

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role, modules })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating role:', error);
      throw error;
    }

    // Registrar cambio
    await this.logActivity('role_changed', 'admin', { target_user: userId, new_role: role });

    return data;
  },

  /**
   * Activar/Desactivar usuario (admin only)
   */
  async toggleUserActive(userId, isActive) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ is_active: isActive })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling user status:', error);
      throw error;
    }

    await this.logActivity('user_status_changed', 'admin', { target_user: userId, is_active: isActive });

    return data;
  },

  /**
   * Actualizar módulos de un usuario (admin only)
   */
  async updateUserModules(userId, modules) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ modules })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating modules:', error);
      throw error;
    }

    await this.logActivity('modules_changed', 'admin', { target_user: userId, modules });

    return data;
  },

  /**
   * Obtener actividad del sistema (admin only)
   */
  async getSystemActivity(limit = 100, filters = {}) {
    let query = supabase
      .from('user_activity')
      .select(`
          *,
          profile:user_id (
            display_name,
            role
          )
        `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Aplicar filtros opcionales
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.module) {
      query = query.eq('module', filters.module);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.fromDate) {
      query = query.gte('created_at', filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte('created_at', filters.toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activity:', error);
      throw error;
    }

    return data.map(activity => ({
      ...activity,
      display_name: activity.profile?.display_name,
      user_role: activity.profile?.role
    }));
  },

  /**
   * Obtener estadísticas del sistema (admin only)
   */
  async getSystemStats() {
    const [usersResult, activityResult] = await Promise.all([
      supabase.from('user_profiles').select('role, is_active'),
      supabase
        .from('user_activity')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    const users = usersResult.data || [];
    const recentActivity = activityResult.data || [];

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.is_active).length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      activityLast7Days: recentActivity.length
    };
  }
};
