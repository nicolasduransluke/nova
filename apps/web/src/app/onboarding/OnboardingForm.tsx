'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileStore } from '@/store/profile.store';

interface OnboardingData {
  sex: 'male' | 'female' | null;
  age: number;
  height: number;
  weight: number;
  goalWeight: number;
  weeklyGoal: number;
}

const TOTAL_STEPS = 5;

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-8 bg-purple-500'
              : i < current
                ? 'w-2 bg-purple-500/70'
                : 'w-2 bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

function SexStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">Bienvenido a NOVA</h2>
      <p className="text-indigo-200 mb-8">Vamos a personalizar tu experiencia</p>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onChange({ sex: 'male' })}
          className={`p-6 rounded-xl border-2 transition-all ${
            data.sex === 'male'
              ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
              : 'bg-white/5 border-white/20 hover:bg-white/10'
          }`}
        >
          <div className="text-4xl mb-3">
            <svg className="w-12 h-12 mx-auto text-indigo-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 21v-2a6.5 6.5 0 0113 0v2" />
            </svg>
          </div>
          <span className="text-white font-medium">Hombre</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ sex: 'female' })}
          className={`p-6 rounded-xl border-2 transition-all ${
            data.sex === 'female'
              ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
              : 'bg-white/5 border-white/20 hover:bg-white/10'
          }`}
        >
          <div className="text-4xl mb-3">
            <svg className="w-12 h-12 mx-auto text-indigo-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 21v-2a6.5 6.5 0 0113 0v2" />
            </svg>
          </div>
          <span className="text-white font-medium">Mujer</span>
        </button>
      </div>
    </div>
  );
}

function AgeStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">Tu edad</h2>
      <p className="text-indigo-200 mb-8">Necesaria para calcular tu metabolismo</p>
      <div className="flex items-center justify-center gap-6 mb-6">
        <button
          type="button"
          onClick={() => onChange({ age: Math.max(16, data.age - 1) })}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition-colors"
        >
          -
        </button>
        <span className="text-6xl font-bold text-white w-24 text-center">{data.age}</span>
        <button
          type="button"
          onClick={() => onChange({ age: Math.min(80, data.age + 1) })}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition-colors"
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={16}
        max={80}
        value={data.age}
        onChange={(e) => onChange({ age: parseInt(e.target.value, 10) })}
        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
      />
      <div className="flex justify-between text-xs text-indigo-300 mt-1">
        <span>16</span>
        <span>80</span>
      </div>
    </div>
  );
}

function MeasurementsStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Tus medidas</h2>
      <p className="text-indigo-200 mb-8 text-center">Para personalizar tus objetivos</p>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-indigo-200 mb-2">Altura</label>
          <div className="relative">
            <input
              type="number"
              min={100}
              max={250}
              value={data.height}
              onChange={(e) => onChange({ height: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 text-sm">cm</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-indigo-200 mb-2">Peso actual</label>
          <div className="relative">
            <input
              type="number"
              min={30}
              max={300}
              step={0.1}
              value={data.weight}
              onChange={(e) => onChange({ weight: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 text-sm">kg</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const WEEKLY_OPTIONS = [
  { value: 0.25, label: '0.25 kg/sem', desc: 'Conservador' },
  { value: 0.5, label: '0.5 kg/sem', desc: 'Recomendado' },
  { value: 0.75, label: '0.75 kg/sem', desc: 'Moderado' },
  { value: 1.0, label: '1.0 kg/sem', desc: 'Agresivo' },
];

function GoalStep({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  const estimatedWeeks = data.weight > data.goalWeight && data.weeklyGoal > 0
    ? Math.ceil((data.weight - data.goalWeight) / data.weeklyGoal)
    : null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Tu objetivo</h2>
      <p className="text-indigo-200 mb-6 text-center">Define tu meta de peso</p>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-indigo-200 mb-2">Peso meta</label>
          <div className="relative">
            <input
              type="number"
              min={30}
              max={data.weight - 1}
              step={0.1}
              value={data.goalWeight}
              onChange={(e) => onChange({ goalWeight: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 text-sm">kg</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-indigo-200 mb-3">Ritmo semanal</label>
          <div className="grid grid-cols-2 gap-3">
            {WEEKLY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ weeklyGoal: opt.value })}
                className={`p-3 rounded-lg border transition-all text-left ${
                  data.weeklyGoal === opt.value
                    ? 'bg-purple-500/20 border-purple-500'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="text-white font-medium text-sm">{opt.label}</div>
                <div className="text-indigo-300 text-xs">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {estimatedWeeks && (
          <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
            <p className="text-indigo-200 text-sm">Tiempo estimado</p>
            <p className="text-white text-xl font-bold">~{estimatedWeeks} semanas</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WhoopStep({ onConnect, onSkip }: { onConnect: () => void; onSkip: () => void }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">Conecta tu Whoop</h2>
      <p className="text-indigo-200 mb-8">(opcional)</p>
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">W</span>
        </div>
        <p className="text-indigo-100 mb-2">Sincroniza tus datos automáticamente</p>
        <p className="text-indigo-300 text-sm">Calorías quemadas, recuperación, sueño y más</p>
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={onConnect}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all"
        >
          Conectar Whoop
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full py-3 px-4 text-indigo-300 hover:text-white transition-colors"
        >
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}

export default function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const { createProfile, isLoading } = useProfileStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>({
    sex: null,
    age: 25,
    height: 170,
    weight: 70,
    goalWeight: 65,
    weeklyGoal: 0.5,
  });

  const update = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const isStepValid = (): boolean => {
    switch (step) {
      case 0: return data.sex !== null;
      case 1: return data.age >= 16 && data.age <= 80;
      case 2: return data.height >= 100 && data.height <= 250 && data.weight >= 30 && data.weight <= 300;
      case 3: return data.goalWeight > 30 && data.goalWeight < data.weight && data.weeklyGoal > 0;
      default: return true;
    }
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    if (step === 3) {
      // Finalizar - create profile
      setError(null);
      const success = await createProfile({
        weight: data.weight,
        height: data.height,
        age: data.age,
        sex: data.sex,
        objective: 'weight_loss',
        activityLevel: 'moderate',
        goalWeight: data.goalWeight,
        weeklyGoal: data.weeklyGoal,
      });

      if (success) {
        setStep(4); // Whoop step
      } else {
        setError('Error al crear el perfil. Intenta de nuevo.');
      }
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleWhoopConnect = () => {
    const clientId = '8e820c10-a75d-4701-867f-72fd8225d967';
    const redirectUri = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000/auth/whoop/callback'
      : 'https://nova-ebon-seven.vercel.app/auth/whoop/callback';
    const scope = 'read:profile read:cycles read:recovery read:workout read:body_measurement offline';
    const state = Math.random().toString(36).substring(2, 10);

    localStorage.setItem('nova-onboarding-whoop-pending', 'true');

    const url = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
    window.location.href = url;
  };

  const handleSkipWhoop = () => {
    router.push('/');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isStepValid() && step < 4) {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <div
      className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8"
      onKeyDown={handleKeyDown}
    >
      <ProgressDots current={step} />

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          <div className="w-full flex-shrink-0 px-1">
            <SexStep data={data} onChange={update} />
          </div>
          <div className="w-full flex-shrink-0 px-1">
            <AgeStep data={data} onChange={update} />
          </div>
          <div className="w-full flex-shrink-0 px-1">
            <MeasurementsStep data={data} onChange={update} />
          </div>
          <div className="w-full flex-shrink-0 px-1">
            <GoalStep data={data} onChange={update} />
          </div>
          <div className="w-full flex-shrink-0 px-1">
            <WhoopStep onConnect={handleWhoopConnect} onSkip={handleSkipWhoop} />
          </div>
        </div>
      </div>

      {step < 4 && (
        <div className="flex justify-between mt-8">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 text-indigo-300 hover:text-white transition-colors"
            >
              Anterior
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid() || isLoading}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Guardando...
              </span>
            ) : step === 3 ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      )}
    </div>
  );
}
