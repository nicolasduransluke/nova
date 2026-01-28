import React from 'react';
import type { DailySummary } from '@nova/types';

export interface DailySummaryCardProps {
  summary: DailySummary;
  compact?: boolean;
}

export function DailySummaryCard({ summary, compact = false }: DailySummaryCardProps) {
  const { intake, burn, tdee, deficit, targetDeficit, projectedWeeklyLoss, goalWeight, weightProgress } = summary;
  const totalBurn = tdee + burn;
  const progress = totalBurn > 0 ? Math.min((intake / totalBurn) * 100, 100) : 0;
  const isOnTrack = deficit >= targetDeficit * 0.8;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex gap-4">
          <span className="text-gray-600 dark:text-gray-400">
            Consumido: <strong className="text-gray-900 dark:text-white">{intake}</strong>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            Quemado: <strong className="text-gray-900 dark:text-white">{burn}</strong>
          </span>
        </div>
        <span className={`font-bold ${deficit > 0 ? 'text-green-600' : 'text-red-500'}`}>
          Déficit: {deficit} kcal
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
      <h3 className="text-white font-semibold text-lg mb-4">Resumen del Día</h3>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-indigo-200 mb-1">
          <span>{Math.round(progress)}%</span>
          <span>Meta de consumo: {totalBurn - targetDeficit} kcal</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-white">{intake}</p>
          <p className="text-xs text-indigo-300">Consumido</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{burn}</p>
          <p className="text-xs text-indigo-300">Quemado</p>
        </div>
        <div>
          <p className={`text-2xl font-bold ${deficit > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {deficit}
          </p>
          <p className="text-xs text-indigo-300">Déficit</p>
        </div>
      </div>

      {/* TDEE context */}
      <p className="mt-2 text-center text-xs text-indigo-400">
        TDEE base: {tdee} kcal
      </p>

      {/* Projection */}
      <div className="mt-4 text-center text-sm text-indigo-200">
        {isOnTrack ? (
          <p>En camino a perder ~{Math.abs(projectedWeeklyLoss).toFixed(1)} kg/semana</p>
        ) : (
          <p>Meta de déficit: {targetDeficit} kcal/día para perder ~{((targetDeficit * 7) / 7700).toFixed(1)} kg/semana</p>
        )}
        {goalWeight != null && !weightProgress && (
          <p className="mt-1">Meta de peso: {goalWeight} kg</p>
        )}
      </div>

      {/* Weight Progress */}
      {weightProgress && (
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <h4 className="text-white font-medium text-sm mb-2">Progreso de Peso</h4>
          <p className="text-indigo-200 text-sm">
            {weightProgress.current} kg → {weightProgress.goal} kg
            <span className="ml-2 text-indigo-300">
              (faltan {weightProgress.remaining} kg)
            </span>
          </p>
          {weightProgress.change != null && weightProgress.change !== 0 && (
            <p className={`text-sm mt-1 font-medium ${weightProgress.change < 0 ? 'text-green-400' : 'text-red-400'}`}>
              {weightProgress.change > 0 ? '+' : ''}{weightProgress.change} kg desde el inicio
            </p>
          )}
          {weightProgress.trend && (
            <p className="text-xs text-indigo-300 mt-1">
              Tendencia: {weightProgress.trend === 'down' ? 'bajando' : weightProgress.trend === 'up' ? 'subiendo' : 'estable'}
            </p>
          )}
          {weightProgress.estimatedWeeks != null && weightProgress.estimatedWeeks > 0 && (
            <p className="text-sm text-indigo-200 mt-1">
              Meta estimada en ~{weightProgress.estimatedWeeks} semanas
            </p>
          )}
        </div>
      )}
    </div>
  );
}
