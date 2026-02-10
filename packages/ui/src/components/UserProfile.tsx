import React, { useState, useEffect } from 'react';
import type { Profile, WeightLog, ActivityLevel } from '@nova/types';

const AVATAR_GRADIENTS = [
  '#9333ea, #6366f1',
  '#6366f1, #3b82f6',
  '#8b5cf6, #ec4899',
  '#4f46e5, #7c3aed',
  '#a855f7, #6366f1',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash += name.charCodeAt(i);
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export interface UserProfileProps {
  profile: Profile | null;
  weightLogs: WeightLog[];
  currentWeight?: number;
  estimatedWeeks?: number;
  onUpdate: (updates: Partial<Profile>) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  user?: { name: string; email: string; provider: string } | null;
}

const activityLevelLabels: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario',
  light: 'Ligero',
  moderate: 'Moderado',
  active: 'Activo',
  very_active: 'Muy activo',
};

export function UserProfile({
  profile,
  weightLogs,
  currentWeight,
  estimatedWeeks,
  onUpdate,
  onClose,
  isLoading = false,
  user,
}: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    weight: profile?.weight ?? 70,
    height: profile?.height ?? 170,
    age: profile?.age ?? 30,
    sex: profile?.sex ?? 'male',
    goalWeight: profile?.goalWeight ?? '',
    weeklyGoal: profile?.weeklyGoal ?? 0.5,
    activityLevel: profile?.activityLevel ?? 'moderate',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        weight: profile.weight,
        height: profile.height,
        age: profile.age,
        sex: profile.sex,
        goalWeight: profile.goalWeight ?? '',
        weeklyGoal: profile.weeklyGoal ?? 0.5,
        activityLevel: profile.activityLevel ?? 'moderate',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    const updates: Partial<Profile> = {};

    if (formData.weight !== profile?.weight) {
      updates.weight = formData.weight;
    }
    if (formData.height !== profile?.height) {
      updates.height = formData.height;
    }
    if (formData.age !== profile?.age) {
      updates.age = formData.age;
    }
    if (formData.sex !== profile?.sex) {
      updates.sex = formData.sex as Profile['sex'];
    }
    if (formData.goalWeight !== '' && formData.goalWeight !== profile?.goalWeight) {
      updates.goalWeight = Number(formData.goalWeight);
    }
    if (formData.weeklyGoal !== profile?.weeklyGoal) {
      updates.weeklyGoal = formData.weeklyGoal;
    }
    if (formData.activityLevel !== profile?.activityLevel) {
      updates.activityLevel = formData.activityLevel as ActivityLevel;
    }

    if (Object.keys(updates).length > 0) {
      await onUpdate(updates);
    }
    setIsEditing(false);
  };

  // Calculate TDEE
  const calculateTDEE = () => {
    if (!profile) return null;
    const { weight, height, age, sex, activityLevel } = profile;

    // Mifflin-St Jeor
    let bmr: number;
    if (sex === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const multipliers: Record<ActivityLevel, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };

    return Math.round(bmr * (multipliers[activityLevel] || 1.55));
  };

  const tdee = calculateTDEE();
  const displayWeight = currentWeight ?? profile?.weight;
  const remaining = displayWeight && profile?.goalWeight
    ? (displayWeight - profile.goalWeight).toFixed(1)
    : null;

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
          <p className="text-gray-600 dark:text-gray-300 text-center">
            No se encontró el perfil
          </p>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mi Perfil
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Account Info */}
          {user && (
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${getAvatarColor(user.name || 'U')})`,
                }}
              >
                <span className="text-xl font-bold text-white">
                  {(user.name?.charAt(0) || '?').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {user.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
                {user.provider !== 'local' && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {user.provider === 'google' ? (
                      <svg className="w-3 h-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    )}
                    {user.provider === 'google' ? 'Google' : 'Apple'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Current Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayWeight ?? profile.weight} kg
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Peso actual</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {tdee ?? '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">TDEE kcal/día</p>
            </div>
          </div>

          {/* Weight Goal Progress */}
          {profile.goalWeight && displayWeight && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm opacity-90">Meta de peso</span>
                <span className="font-bold">{profile.goalWeight} kg</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm opacity-90">Te faltan</span>
                <span className="font-bold">{remaining} kg</span>
              </div>
              {estimatedWeeks && estimatedWeeks > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-90">Tiempo estimado</span>
                  <span className="font-bold">~{estimatedWeeks} semanas</span>
                </div>
              )}
            </div>
          )}

          {/* Editable Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Configuración
              </h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    {isLoading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>

            {/* Goal Weight */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Peso meta (kg)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={formData.goalWeight}
                  onChange={(e) => setFormData({ ...formData, goalWeight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="30"
                  max="300"
                  step="0.1"
                />
              ) : (
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile.goalWeight ?? 'No definido'}
                </p>
              )}
            </div>

            {/* Weekly Goal */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Meta semanal (kg/semana)
              </label>
              {isEditing ? (
                <select
                  value={formData.weeklyGoal}
                  onChange={(e) => setFormData({ ...formData, weeklyGoal: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={0.25}>0.25 kg (conservador)</option>
                  <option value={0.5}>0.5 kg (recomendado)</option>
                  <option value={0.75}>0.75 kg (moderado)</option>
                  <option value={1.0}>1.0 kg (agresivo)</option>
                  <option value={1.5}>1.5 kg (muy agresivo)</option>
                  <option value={2.0}>2.0 kg (máximo)</option>
                </select>
              ) : (
                <p className="text-gray-900 dark:text-white font-medium">
                  {profile.weeklyGoal ?? 0.5} kg/semana
                </p>
              )}
            </div>

            {/* Activity Level */}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Nivel de actividad
              </label>
              {isEditing ? (
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value as ActivityLevel })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {Object.entries(activityLevelLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 dark:text-white font-medium">
                  {activityLevelLabels[profile.activityLevel] || 'Moderado'}
                </p>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Datos básicos
            </h3>
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Altura (cm)</label>
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      min="100"
                      max="250"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Edad</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      min="10"
                      max="120"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Peso actual (kg)</label>
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      min="30"
                      max="300"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sexo</label>
                    <select
                      value={formData.sex}
                      onChange={(e) => setFormData({ ...formData, sex: e.target.value as 'male' | 'female' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="male">Masculino</option>
                      <option value="female">Femenino</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{profile.height} cm</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Altura</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{profile.age}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Edad</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {profile.sex === 'male' ? 'M' : profile.sex === 'female' ? 'F' : '—'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sexo</p>
                </div>
              </div>
            )}
          </div>

          {/* Whoop Integration */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Integraciones
            </h3>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">W</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Whoop</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sincroniza calorías quemadas</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const whoopClientId = '8e820c10-a75d-4701-867f-72fd8225d967';
                  // Use localhost for development, production URL for deployed app
                  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
                  const redirectUri = encodeURIComponent(
                    isLocalhost
                      ? 'http://localhost:3000/auth/whoop/callback'
                      : 'https://nova-ebon-seven.vercel.app/auth/whoop/callback'
                  );
                  const scopes = encodeURIComponent('read:profile read:cycles read:recovery read:workout read:body_measurement offline');
                  const state = Math.random().toString(36).substring(2, 10); // 8 chars required
                  const authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${whoopClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}`;
                  window.location.href = authUrl;
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Conectar
              </button>
            </div>
          </div>

          {/* Weight History */}
          {weightLogs.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Historial de peso (últimos 7)
              </h3>
              <div className="space-y-2">
                {weightLogs.slice(0, 7).map((log, i) => (
                  <div key={log.id || i} className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(log.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {log.weight} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
