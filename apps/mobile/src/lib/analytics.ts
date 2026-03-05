import PostHog from 'posthog-react-native';
import { POSTHOG_API_KEY } from '@/config/env';

export const posthog = new PostHog(POSTHOG_API_KEY, {
  host: 'https://us.i.posthog.com',
  enableSessionReplay: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

export function identify(userId: string, properties?: Props) {
  posthog.identify(userId, properties);
}

export function reset() {
  posthog.reset();
}

export function capture(event: string, properties?: Props) {
  posthog.capture(event, properties);
}
