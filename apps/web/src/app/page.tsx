'use client';

import Link from 'next/link';
import { Button, Card } from '@nova/ui';
import { DailySummaryCard } from '@nova/ui';
import { useChatStore } from '@/store/chat.store';

export default function Home() {
  const { dailySummary } = useChatStore();

  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">
            NOVA
          </h1>
          <p className="text-xl text-indigo-200">
            Coach de Déficit Calórico
          </p>
        </header>

        {dailySummary ? (
          <div className="mb-8">
            <DailySummaryCard summary={dailySummary} />
          </div>
        ) : (
          <Card variant="elevated" className="bg-white/10 backdrop-blur-lg border border-white/20 mb-8">
            <div className="text-center py-4">
              <p className="text-indigo-200 text-lg mb-2">
                Registra tu primera comida o actividad para ver tu resumen del día
              </p>
              <div className="flex justify-center gap-8 mt-4 text-indigo-300">
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-sm">kcal consumidas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-sm">kcal quemadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">--</p>
                  <p className="text-sm">déficit</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="text-center">
          <Link href="/chat">
            <Button variant="primary" size="lg" className="px-12 py-4 text-lg">
              Hablar con NOVA
            </Button>
          </Link>
        </div>

        <footer className="mt-12 text-center text-indigo-300 text-sm">
          <p>NOVA v0.2.0 - Tu coach de déficit calórico</p>
        </footer>
      </div>
    </main>
  );
}
