// User Domain
export type AuthProvider = 'local' | 'google' | 'apple';

export interface User {
  id: string;
  email: string;
  name: string;
  provider: AuthProvider;
  providerId?: string;
  emailVerified: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  metadata?: Record<string, unknown>;
}

// Auth Domain
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

// Profile Domain
export type Sex = 'male' | 'female' | 'other';
export type Objective = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'energy' | 'sleep' | 'stress';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface Profile {
  id: string;
  userId: string;
  weight: number; // in kg
  height: number; // in cm
  age: number;
  sex: Sex;
  objective: Objective;
  activityLevel: ActivityLevel;
  goalWeight?: number; // target weight in kg
  weeklyGoal?: number; // kg/week to lose (default 0.5)
  targetWeeks?: number; // weeks to reach goal weight
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfileDTO {
  userId: string;
  weight: number;
  height: number;
  age: number;
  sex: Sex;
  objective: Objective;
  activityLevel?: ActivityLevel;
  goalWeight?: number;
  weeklyGoal?: number;
}

// Daily Entry Domain (legacy)
export type EntryType = 'food' | 'exercise' | 'sleep' | 'mood' | 'energy' | 'custom';

export interface DailyEntry {
  id: string;
  userId: string;
  date: Date;
  type: EntryType;
  data: Record<string, unknown>;
  novaPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDailyEntryDTO {
  userId: string;
  date: Date;
  type: EntryType;
  data: Record<string, unknown>;
  novaPoints?: number;
}

// Calorie Entry Domain
export type CalorieEntryType = 'intake' | 'burn';

export interface CalorieEntryItem {
  name: string;
  calories: number;
  quantity?: number;
  protein?: number;  // grams
  carbs?: number;    // grams
  fat?: number;      // grams
  imageUrl?: string;
  source?: 'usda' | 'gemini' | 'vision' | 'fallback';
  portionSize?: number;   // assumed piece count (e.g. 10 for nuggets, 2 for eggs)
  portionLabel?: string;  // unit in Spanish (e.g. "piezas", "rebanadas", "unidad")
}

export interface CalorieEntry {
  id: string;
  userId: string;
  date: Date;
  type: CalorieEntryType;
  description: string;
  calories: number;
  items: CalorieEntryItem[];
  confirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCalorieEntryDTO {
  userId: string;
  date: Date;
  type: CalorieEntryType;
  description: string;
  calories: number;
  items: CalorieEntryItem[];
  confirmed?: boolean;
}

// Weight Log Domain
export interface WeightLog {
  id: string;
  userId: string;
  weight: number; // kg
  date: Date;
  createdAt: Date;
}

export interface CreateWeightLogDTO {
  userId: string;
  weight: number;
  date: Date;
}

// History Domain
export interface HistoryDayEntry {
  id: string;
  type: CalorieEntryType;
  description: string;
  calories: number;
  items: CalorieEntryItem[];
  createdAt: string;
}

export interface HistoryDay {
  date: string;
  summary: DailySummary;
  entries: HistoryDayEntry[];
}

export interface WeightEntry {
  date: string;
  weight: number;
}

// Agent Domain
export type AgentType =
  | 'metabolic'
  | 'nutrition'
  | 'activity'
  | 'integrator';

// Calorie Estimate Types
export interface CalorieEstimate {
  items: CalorieEntryItem[];
  totalCalories: number;
}

export interface ActivityEstimate {
  activity: string;
  durationMinutes: number;
  caloriesBurned: number;
}

export interface PendingEntry {
  id: string;
  type: CalorieEntryType;
  description: string;
  calories: number;
  items: CalorieEntryItem[];
  createdAt: Date;
}

export interface WeightProgress {
  current: number;
  goal: number;
  remaining: number;
  change?: number; // kg changed from starting weight (negative = lost)
  trend?: 'up' | 'down' | 'stable';
  estimatedWeeks?: number; // estimated weeks to reach goal at current weeklyGoal
}

export interface DailySummary {
  date: Date;
  intake: number;
  burn: number;
  burnSource?: 'manual' | 'whoop'; // source of burn calories
  tdee: number;
  deficit: number;
  targetDeficit: number;
  projectedWeeklyLoss: number; // kg
  goalWeight?: number; // target weight in kg
  currentWeight?: number; // last recorded weight
  weeklyWeightTarget?: number; // target weight for end of this week (based on start-of-week weight)
  weightProgress?: WeightProgress;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health Check
export interface HealthCheck {
  status: 'ok' | 'error';
  timestamp: Date;
  services: {
    database: boolean;
    cache?: boolean;
  };
}

// Chat Domain
export type MessageType =
  | 'text'
  | 'image'
  | 'weight'
  | 'sleep'
  | 'meal'
  | 'workout'
  | 'energy';

export type MessageSender = 'user' | 'agent';

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  imageUrl?: string;
  sender: MessageSender;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateMessageDTO {
  type: MessageType;
  content: string;
  imageUrl?: string;
  sender: MessageSender;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: Message[];
  startedAt: Date;
  lastMessageAt: Date;
}

// Agent Orchestrator Domain
export type MessageIntent =
  | 'meal_log'
  | 'activity_log'
  | 'weight_log'
  | 'goal_set'
  | 'profile_setup'
  | 'entry_edit'
  | 'confirmation'
  | 'question'
  | 'greeting'
  | 'general';

export type ResponseTone = 'calm' | 'encouraging' | 'informative';

export interface AgentContext {
  user: User;
  profile?: Profile;
  recentEntries: DailyEntry[];
  conversationHistory: Message[];
  currentDate: Date;
}

export interface AgentOutput {
  agentType: string;
  insights: string[];
  recommendations: string[];
  dataPoints: Record<string, unknown>;
  confidence: number;
}

export interface FinalResponse {
  message: string;
  tone: ResponseTone;
  actionItems?: string[];
  nextSteps?: string[];
  dailySummary?: DailySummary;
  foodItems?: CalorieEntryItem[];
}

export interface ProcessMessageRequest {
  userId: string;
  content: string;
  imageUrl?: string;
  messageType?: MessageType;
  timezone?: string;
}

export interface ProcessMessageResponse {
  success: boolean;
  response: FinalResponse;
  intent: MessageIntent;
  processedAt: Date;
}
