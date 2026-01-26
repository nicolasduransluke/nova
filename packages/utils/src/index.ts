/**
 * Generate a unique identifier
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Calculate BMI (Body Mass Index)
 * @param weightKg Weight in kilograms
 * @param heightCm Height in centimeters
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) {
    throw new Error('Weight and height must be positive numbers');
  }
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

/**
 * Calculate NOVA points based on entry type and data
 */
export function calculateNovaPoints(
  type: string,
  data: Record<string, unknown>
): number {
  const basePoints: Record<string, number> = {
    food: 10,
    exercise: 15,
    sleep: 12,
    mood: 5,
    energy: 5,
    custom: 3,
  };

  let points = basePoints[type] || 0;

  // Bonus points for completeness
  const dataKeys = Object.keys(data);
  if (dataKeys.length >= 3) points += 5;
  if (dataKeys.length >= 5) points += 5;

  return points;
}

/**
 * Format date to ISO string without time
 */
export function formatDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return formatDateOnly(date) === formatDateOnly(today);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError;
}
