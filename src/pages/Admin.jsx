import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Users, Activity, Shield, Check, X, Loader2, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import MobileNav from '../components/common/MobileNav';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { userService } from '../services/userService';

export default function Admin() {
  const { user, signOut } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, activityData, statsData] = await Promise.all([
        userService.getAllUsers(),
        userService.getSystemActivity(100),
        userService.getSystemStats()
      ]);
      setUsers(usersData || []);
      setActivity(activityData || []);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleRole = async (userId, currentRole, email) => {
    if (email === user.email) {
      alert('No puedes cambiar tu propio rol');
      return;
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`¿Cambiar rol de ${email} a ${newRole.toUpperCase()}?`)) return;

    setActionLoading(userId);
    try {
      await userService.updateUserRole(userId, newRole);
      await loadData();
    } catch (err) {
      alert('Error al cambiar rol: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (userId, isActive, email) => {
    if (email === user.email) {
      alert('No puedes desactivar tu propia cuenta');
      return;
    }

    const action = isActive ? 'desactivar' : 'activar';
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario ${email}?`)) return;

    setActionLoading(userId);
    try {
      await userService.toggleUserActive(userId, !isActive);
      await loadData();
    } catch (err) {
      alert('Error al cambiar estado: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrar usuarios
  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchTerm ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background-primary flex">
        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary/95 backdrop-blur-xl border-b border-border-primary px-4 py-3">
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Administración
          </h1>
        </div>

        <DashboardSidebar
          user={user}
          signOut={signOut}
          isExpanded={sidebarExpanded}
          setIsExpanded={setSidebarExpanded}
        />

        <main className={`flex-1 transition-all duration-300 mt-16 lg:mt-0 pb-20 lg:pb-0 ${sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'
          }`}>
          <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-semibold text-text-primary flex items-center gap-2">
                  <Shield className="w-6 h-6 text-primary" />
                  Panel de Administración
                </h1>
                <p className="text-text-tertiary text-sm mt-1">
                  Gestión de usuarios y actividad del sistema
                </p>
              </div>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-background-tertiary text-text-secondary border border-border-primary rounded-lg hover:text-text-primary transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
                  <p className="text-text-tertiary text-xs font-medium uppercase">Total Usuarios</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{stats.totalUsers}</p>
                </div>
                <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
                  <p className="text-text-tertiary text-xs font-medium uppercase">Usuarios Activos</p>
                  <p className="text-2xl font-bold text-profit mt-1">{stats.activeUsers}</p>
                </div>
                <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
                  <p className="text-text-tertiary text-xs font-medium uppercase">Administradores</p>
                  <p className="text-2xl font-bold text-primary mt-1">{stats.adminUsers}</p>
                </div>
                <div className="bg-background-secondary border border-border-primary rounded-xl p-4">
                  <p className="text-text-tertiary text-xs font-medium uppercase">Actividad (7d)</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{stats.activityLast7Days}</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border-primary">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-primary'
                  }`}
              >
                <Users className="w-4 h-4" />
                Usuarios ({users.length})
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'activity'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-primary'
                  }`}
              >
                <Activity className="w-4 h-4" />
                Actividad
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : activeTab === 'users' ? (
              <>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <input
                      type="text"
                      placeholder="Buscar por email o nombre..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2.5 bg-background-secondary border border-border-primary rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">Todos los roles</option>
                    <option value="admin">Administradores</option>
                    <option value="user">Usuarios</option>
                  </select>
                </div>

                {/* Users Table */}
                <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="bg-background-tertiary text-left text-xs font-bold text-text-tertiary uppercase">
                          <th className="px-4 py-3">Usuario</th>
                          <th className="px-4 py-3">Rol</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Registro</th>
                          <th className="px-4 py-3">Último Login</th>
                          <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-primary">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-4 py-8 text-center text-text-tertiary">
                              No se encontraron usuarios
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((u) => (
                            <tr key={u.user_id} className="hover:bg-background-tertiary/50 transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-text-primary">{u.display_name || 'Sin nombre'}</p>
                                  <p className="text-xs text-text-tertiary">{u.email}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${u.role === 'admin'
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-background-tertiary text-text-secondary'
                                  }`}>
                                  {u.role?.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.is_active ? 'text-profit' : 'text-loss'
                                  }`}>
                                  {u.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                  {u.is_active ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-text-tertiary">
                                {formatDateShort(u.created_at)}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-tertiary">
                                {formatDateShort(u.last_sign_in)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleToggleRole(u.user_id, u.role, u.email)}
                                    disabled={actionLoading === u.user_id || u.email === user.email}
                                    className="px-2.5 py-1.5 text-xs font-medium bg-background-tertiary text-text-secondary rounded-lg hover:text-text-primary hover:bg-border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading === u.user_id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      u.role === 'admin' ? 'Hacer User' : 'Hacer Admin'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleToggleActive(u.user_id, u.is_active, u.email)}
                                    disabled={actionLoading === u.user_id || u.email === user.email}
                                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${u.is_active
                                        ? 'bg-loss/10 text-loss hover:bg-loss/20'
                                        : 'bg-profit/10 text-profit hover:bg-profit/20'
                                      }`}
                                  >
                                    {u.is_active ? 'Desactivar' : 'Activar'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              /* Activity Log */
              <div className="bg-background-secondary border border-border-primary rounded-xl overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                  {activity.length === 0 ? (
                    <div className="p-8 text-center text-text-tertiary">
                      No hay actividad registrada
                    </div>
                  ) : (
                    <div className="divide-y divide-border-primary">
                      {activity.map((a) => (
                        <div key={a.id} className="px-4 py-3 hover:bg-background-tertiary/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary">
                                {a.action}
                              </p>
                              <p className="text-xs text-text-tertiary mt-0.5">
                                {a.display_name || 'Usuario'} • {formatDate(a.created_at)}
                              </p>
                              {a.module && (
                                <span className="inline-flex mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-background-tertiary text-text-tertiary rounded">
                                  {a.module}
                                </span>
                              )}
                            </div>
                            {a.details && Object.keys(a.details).length > 0 && (
                              <code className="hidden sm:block text-[10px] bg-background-tertiary px-2 py-1 rounded text-text-tertiary max-w-xs truncate">
                                {JSON.stringify(a.details)}
                              </code>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <MobileNav />
      </div>
    </ErrorBoundary>
  );
}
