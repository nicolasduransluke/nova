import React from 'react';
import type { DailySummary } from '@nova/types';

export interface DailySummaryCardProps {
  summary: DailySummary;
  compact?: boolean;
}

export function DailySummaryCard({ summary, compact = false }: DailySummaryCardProps) {
  const { intake, burn, tdee, deficit, targetDeficit, goalWeight, currentWeight, weightProgress } = summary;
  const totalBurn = tdee + burn;
  const progress = totalBurn > 0 ? Math.min((intake / totalBurn) * 100, 100) : 0;
  const isOnTrack = deficit >= targetDeficit * 0.8;
  const tomorrowWeight = currentWeight != null ? currentWeight - (deficit / 7700) : null;
  // Dynamic weeks to goal based on today's deficit
  const weeklyLossAtCurrentRate = (deficit * 7) / 7700;
  const dynamicWeeksToGoal = weightProgress && weeklyLossAtCurrentRate > 0
    ? Math.round(weightProgress.remaining / weeklyLossAtCurrentRate)
    : null;
  // Deficit progress
  const deficitProgress = targetDeficit > 0 ? Math.min((deficit / targetDeficit) * 100, 150) : 0;
  // Remaining calories to eat
  const remainingToEat = totalBurn - targetDeficit - intake;

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

      {/* Deficit progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-indigo-200 mb-1">
          <span>Meta de déficit: {targetDeficit} kcal</span>
          <span>Logrado: <span className={deficit >= targetDeficit ? 'text-green-400' : 'text-white'}>{deficit} kcal</span></span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              deficitProgress >= 100 ? 'bg-green-500' : deficitProgress >= 70 ? 'bg-yellow-500' : 'bg-red-400'
            }`}
            style={{ width: `${Math.min(deficitProgress, 100)}%` }}
          />
        </div>
        <p className="text-center text-xs text-indigo-300 mt-1">
          {deficitProgress >= 100 ? '¡Meta cumplida!' : `${Math.round(deficitProgress)}% de tu meta`}
        </p>
      </div>

      {/* Main stats: Consumido y Ejercicio */}
      <div className="grid grid-cols-2 gap-4 text-center mb-4">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-2xl font-bold text-white">{intake}</p>
          <p className="text-xs text-indigo-300">Consumido</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-400">{burn}</p>
          <p className="text-xs text-indigo-300">Ejercicio</p>
        </div>
      </div>

      {/* Remaining budget - secondary */}
      <div className="text-center mb-2">
        <p className="text-indigo-300 text-sm">
          Te quedan por comer: <span className={`font-bold ${remainingToEat > 0 ? 'text-white' : 'text-red-400'}`}>{remainingToEat > 0 ? remainingToEat : 0} kcal</span>
          {remainingToEat < 0 && <span className="text-red-400 text-xs ml-1">(excedido por {Math.abs(remainingToEat)})</span>}
        </p>
      </div>

      {/* TDEE context */}
      <p className="text-center text-xs text-indigo-400">
        TDEE base: {tdee} kcal
      </p>

      {/* Tomorrow projection */}
      <div className="mt-4 text-center text-sm text-indigo-200">
        {tomorrowWeight != null ? (
          <p>
            Mañana: <span className={`font-medium ${deficit > 0 ? 'text-green-400' : 'text-red-400'}`}>~{tomorrowWeight.toFixed(1)} kg</span>
            {deficit > 0 && currentWeight != null && (
              <span className="text-indigo-300 ml-1">({(deficit / 7700).toFixed(2)} kg menos)</span>
            )}
          </p>
        ) : (
          <p>Registra tu peso para ver la proyección de mañana</p>
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
          {dynamicWeeksToGoal != null && dynamicWeeksToGoal > 0 ? (
            <p className="text-sm text-indigo-200 mt-1">
              A este ritmo: <span className={`font-medium ${isOnTrack ? 'text-green-400' : 'text-yellow-400'}`}>~{dynamicWeeksToGoal} semanas</span>
            </p>
          ) : deficit <= 0 && weightProgress.remaining > 0 ? (
            <p className="text-sm text-red-400 mt-1">
              Sin déficit no hay progreso
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
