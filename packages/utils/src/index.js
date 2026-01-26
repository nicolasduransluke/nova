"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.calculateBMI = calculateBMI;
exports.calculateNovaPoints = calculateNovaPoints;
exports.formatDateOnly = formatDateOnly;
exports.isToday = isToday;
exports.sleep = sleep;
exports.retry = retry;
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
function calculateBMI(weightKg, heightCm) {
    if (weightKg <= 0 || heightCm <= 0) {
        throw new Error('Weight and height must be positive numbers');
    }
    const heightM = heightCm / 100;
    return Number((weightKg / (heightM * heightM)).toFixed(2));
}
function calculateNovaPoints(type, data) {
    const basePoints = {
        food: 10,
        exercise: 15,
        sleep: 12,
        mood: 5,
        energy: 5,
        custom: 3,
    };
    let points = basePoints[type] || 0;
    const dataKeys = Object.keys(data);
    if (dataKeys.length >= 3)
        points += 5;
    if (dataKeys.length >= 5)
        points += 5;
    return points;
}
function formatDateOnly(date) {
    return date.toISOString().split('T')[0];
}
function isToday(date) {
    const today = new Date();
    return formatDateOnly(date) === formatDateOnly(today);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function retry(fn, maxAttempts = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await sleep(baseDelayMs * Math.pow(2, attempt - 1));
            }
        }
    }
    throw lastError;
}
//# sourceMappingURL=index.js.map