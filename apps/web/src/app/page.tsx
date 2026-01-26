import Link from 'next/link';
import { Button, Card, NovaPointsBadge } from '@nova/ui';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-nova-dark via-indigo-900 to-purple-900 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            NOVA
          </h1>
          <p className="text-xl text-indigo-200">
            Human Energy Intelligence System
          </p>
          <div className="mt-4">
            <NovaPointsBadge points={0} size="lg" />
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <Card variant="elevated" className="bg-white/10 backdrop-blur-lg border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-3">
              Track Your Energy
            </h2>
            <p className="text-indigo-200 mb-4">
              Log your daily activities, nutrition, sleep, and mood to understand your energy patterns.
            </p>
            <Link href="/chat">
              <Button variant="primary">
                Start Tracking
              </Button>
            </Link>
          </Card>

          <Card variant="elevated" className="bg-white/10 backdrop-blur-lg border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-3">
              AI Coaching
            </h2>
            <p className="text-indigo-200 mb-4">
              Get personalized recommendations from your AI health coach based on your data.
            </p>
            <Link href="/chat">
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                Meet Your Coach
              </Button>
            </Link>
          </Card>

          <Card variant="elevated" className="bg-white/10 backdrop-blur-lg border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-3">
              Insights & Analytics
            </h2>
            <p className="text-indigo-200 mb-4">
              Visualize your progress and discover patterns in your health data.
            </p>
            <Button variant="ghost" className="text-indigo-200 hover:bg-white/10">
              View Dashboard
            </Button>
          </Card>

          <Card variant="elevated" className="bg-white/10 backdrop-blur-lg border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-3">
              NOVA Points
            </h2>
            <p className="text-indigo-200 mb-4">
              Earn points for healthy habits and unlock achievements on your wellness journey.
            </p>
            <Button variant="secondary">
              Earn Points
            </Button>
          </Card>
        </div>

        <footer className="mt-12 text-center text-indigo-300 text-sm">
          <p>NOVA v0.1.0 - Your journey to optimal energy starts here</p>
        </footer>
      </div>
    </main>
  );
}
