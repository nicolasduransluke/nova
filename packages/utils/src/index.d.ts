export declare function generateId(): string;
export declare function calculateBMI(weightKg: number, heightCm: number): number;
export declare function calculateNovaPoints(type: string, data: Record<string, unknown>): number;
export declare function formatDateOnly(date: Date): string;
export declare function isToday(date: Date): boolean;
export declare function sleep(ms: number): Promise<void>;
export declare function retry<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelayMs?: number): Promise<T>;
//# sourceMappingURL=index.d.ts.map