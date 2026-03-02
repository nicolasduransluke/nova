import Image from 'next/image';
import Link from 'next/link';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/nova-ai-coach/id6759004608';

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21 8 14l-6-4.6h7.6L12 2z" />
    </svg>
  );
}

function AppStoreBadge() {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block transition-transform hover:scale-105"
    >
      <svg
        viewBox="0 0 120 40"
        className="h-[52px] w-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="120" height="40" rx="6" fill="black" />
        <rect
          x="0.5"
          y="0.5"
          width="119"
          height="39"
          rx="5.5"
          stroke="white"
          strokeOpacity="0.25"
          fill="none"
        />
        <text
          x="42.5"
          y="14"
          fill="white"
          fontSize="5.5"
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing="0.02em"
        >
          Download on the
        </text>
        <text
          x="42.5"
          y="27"
          fill="white"
          fontSize="11"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="600"
          letterSpacing="-0.01em"
        >
          App Store
        </text>
        <g transform="translate(12, 7) scale(1.08)">
          <path
            d="M15.77 13.29c-.03-2.78 2.27-4.12 2.37-4.18-1.29-1.89-3.3-2.15-4.02-2.18-1.71-.17-3.34 1.01-4.21 1.01-.87 0-2.22-.99-3.65-.96-1.88.03-3.61 1.09-4.58 2.78-1.95 3.38-.5 8.4 1.4 11.14.93 1.35 2.04 2.86 3.5 2.81 1.4-.06 1.93-.91 3.63-.91 1.7 0 2.18.91 3.67.88 1.51-.03 2.48-1.37 3.39-2.73 1.07-1.57 1.51-3.09 1.53-3.17-.03-.01-2.94-1.13-2.97-4.47l-.06-.02z"
            fill="white"
          />
          <path
            d="M13.05 4.66c.77-.94 1.29-2.24 1.15-3.54-1.11.05-2.45.74-3.25 1.67-.71.82-1.34 2.14-1.17 3.4 1.24.1 2.5-.63 3.27-1.53z"
            fill="white"
          />
        </g>
      </svg>
    </a>
  );
}

const features = [
  {
    title: 'Smart Calorie Coaching',
    description:
      'Chat with Nova to log meals, track your caloric deficit, and get real-time guidance to hit your weight loss goals.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
        />
      </svg>
    ),
  },
  {
    title: 'Whoop Integration',
    description:
      'Sync your Whoop data so Nova factors in your daily calorie burn, recovery, and activity into your deficit plan.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    ),
  },
  {
    title: 'Weight & Deficit Tracking',
    description:
      'Monitor your daily calories, track your weight over time, and see exactly how your deficit is driving results.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
    ),
  },
];

const screenshots = [
  '/screenshot-coach.png',
  '/screenshot-log.png',
  '/screenshot-profile.png',
  '/screenshot-history.png',
];

const steps = [
  {
    number: '1',
    title: 'Log meals via chat or photo',
    description:
      'Tell Nova what you ate or snap a photo. It counts the calories instantly and tracks your daily deficit.',
  },
  {
    number: '2',
    title: 'Connect your Whoop',
    description:
      'Sync your calorie burn and recovery data so your deficit target adjusts to your real activity.',
  },
  {
    number: '3',
    title: 'Watch the weight drop',
    description:
      'See your weight trend, daily calorie balance, and how consistently you are hitting your deficit.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-nova-dark via-indigo-950 to-nova-dark text-white">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-nova-primary/20 blur-[120px]" />

        <div className="relative flex flex-col items-center text-center max-w-2xl mx-auto">
          <div className="mb-6 relative">
            <Image
              src="/icon.png"
              alt="Nova logo"
              width={96}
              height={96}
              className="rounded-[22px] shadow-2xl shadow-nova-primary/30"
              priority
            />
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
            NOVA
          </h1>
          <p className="text-xl sm:text-2xl text-indigo-200 mb-8 max-w-lg">
            Lose weight with AI-powered calorie tracking
          </p>

          <AppStoreBadge />

          <p className="mt-4 text-sm text-indigo-300/70">
            Available on iPhone and iPad
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Your weight loss system
          </h2>
          <p className="text-indigo-300 text-center mb-12 max-w-xl mx-auto">
            Nova combines AI coaching, calorie tracking, and wearable data to
            keep you in a caloric deficit — the only proven way to lose weight.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 transition-colors hover:border-nova-primary/40 hover:bg-white/[0.08]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-nova-primary/20 text-nova-primary">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-indigo-200/70 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="py-16 sm:py-24">
        <div className="flex gap-4 overflow-x-auto px-6 pb-4 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-4 sm:gap-6 sm:overflow-visible sm:max-w-5xl sm:mx-auto">
          {screenshots.map((src) => (
            <div
              key={src}
              className="flex-shrink-0 w-[240px] sm:w-auto snap-center rounded-2xl overflow-hidden"
            >
              <Image
                src={src}
                alt="Nova app screenshot"
                width={390}
                height={844}
                className="w-full h-auto"
              />
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            How it works
          </h2>
          <p className="text-indigo-300 text-center mb-12">
            Get started in minutes.
          </p>

          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-5 items-start">
                <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-nova-primary text-white font-bold text-lg">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
                  <p className="text-sm text-indigo-200/70 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <StarIcon className="h-10 w-10 text-nova-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start losing weight today
          </h2>
          <p className="text-indigo-300 mb-8 max-w-md mx-auto">
            Download Nova and let AI coach you through every meal to stay on
            deficit and reach your goal weight.
          </p>
          <AppStoreBadge />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-indigo-300/50">
            @ {new Date().getFullYear()} @nicolasdurans. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-sm text-indigo-300/50 hover:text-indigo-200 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/support"
              className="text-sm text-indigo-300/50 hover:text-indigo-200 transition-colors"
            >
              Support
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
