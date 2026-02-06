import { supabase, supabaseFetch } from '@/lib/supabase';

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
          return this.getProfile(userId);
        }
        return null;
      }

      return data;
    } catch (err) {
      return null;
    }
  },

  /**
   * Obtener perfil de un usuario específico
   * @param {string} userId - ID del usuario de Supabase
   */
  async getProfile(userId) {
    if (!userId) return null;

    try {
      // Usar fetch directo para evitar el bloqueo del cliente de Supabase
      const { data, error } = await supabaseFetch('user_profiles', {
        select: '*',
        eq: { user_id: userId },
        single: true
      });

      if (error) {
        if (error.code === '406' || error.code === 'PGRST116') {
          return this.createProfileIfNotExists(userId);
        }
        throw error;
      }

      return data;
    } catch (err) {
      // Si es un 406 (no encontrado con single), crear perfil
      if (err.code === '406') {
        return this.createProfileIfNotExists(userId);
      }
      throw err;
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
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

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
      // Silently ignore activity logging errors
    }
  },

  // ============================================================================
  // Funciones solo para administradores
  // ============================================================================

  /**
   * Listar todos los usuarios (admin only)
   * Nota: No podemos hacer join con auth.users desde el cliente,
   * así que solo devolvemos los datos de user_profiles
   */
  async getAllUsers() {
    try {
      // Usar fetch directo para evitar bloqueo del cliente
      const { data, error } = await supabaseFetch('user_profiles', {
        select: '*'
      });

      if (error) {
        throw error;
      }

      // Ordenar por created_at descendente
      const sorted = (data || []).sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      );

      // El email y fechas ahora vienen directamente de user_profiles gracias a la sincronización
      return sorted.map(profile => ({
        ...profile,
        email: profile.email || profile.display_name || 'Sin email',
        last_sign_in: profile.last_sign_in_at,
        user_created_at: profile.registered_at || profile.created_at
      }));
    } catch (err) {
      return [];
    }
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
      throw error;
    }

    await this.logActivity('modules_changed', 'admin', { target_user: userId, modules });

    return data;
  },

  /**
   * Obtener actividad del sistema (admin only)
   */
  async getSystemActivity(limit = 100, filters = {}) {
    try {
      // Usar fetch directo para evitar bloqueo del cliente
      const { data, error } = await supabaseFetch('user_activity', {
        select: '*',
        limit
      });

      if (error) {
        throw error;
      }

      // Ordenar y filtrar manualmente
      let filtered = data || [];

      if (filters.userId) {
        filtered = filtered.filter(a => a.user_id === filters.userId);
      }
      if (filters.module) {
        filtered = filtered.filter(a => a.module === filters.module);
      }
      if (filters.action) {
        filtered = filtered.filter(a => a.action === filters.action);
      }
      if (filters.fromDate) {
        filtered = filtered.filter(a => new Date(a.created_at) >= new Date(filters.fromDate));
      }
      if (filters.toDate) {
        filtered = filtered.filter(a => new Date(a.created_at) <= new Date(filters.toDate));
      }

      // Ordenar por fecha descendente
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return filtered.slice(0, limit).map(activity => ({
        ...activity,
        display_name: activity.display_name || 'Usuario'
      }));
    } catch (err) {
      return [];
    }
  },

  /**
   * Obtener estadísticas del sistema (admin only)
   */
  async getSystemStats() {
    try {
      // Usar fetch directo para evitar bloqueo del cliente
      const [usersResult, activityResult] = await Promise.all([
        supabaseFetch('user_profiles', { select: 'role,is_active' }),
        supabaseFetch('user_activity', { select: 'created_at' })
      ]);

      const users = usersResult.data || [];
      // Filtrar actividad de últimos 7 días manualmente
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentActivity = (activityResult.data || []).filter(a =>
        new Date(a.created_at) >= sevenDaysAgo
      );

      return {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        adminUsers: users.filter(u => u.role === 'admin').length,
        activityLast7Days: recentActivity.length
      };
    } catch (err) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        activityLast7Days: 0
      };
    }
  }
};
