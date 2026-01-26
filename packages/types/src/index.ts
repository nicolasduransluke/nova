// User Domain
export interface User {
  id: string;
  email: string;
  name: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  metadata?: Record<string, unknown>;
}

// Profile Domain
export type Sex = 'male' | 'female' | 'other';
export type Objective = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'energy' | 'sleep' | 'stress';

export interface Profile {
  id: string;
  userId: string;
  weight: number; // in kg
  height: number; // in cm
  age: number;
  sex: Sex;
  objective: Objective;
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
}

// Daily Entry Domain
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

// Agent Domain
export type AgentType =
  | 'metabolic'
  | 'nutrition'
  | 'training'
  | 'sleep'
  | 'energy'
  | 'integrator'
  | 'coach'
  | 'analyst'
  | 'planner'
  | 'motivator';

export type AgentStatus = 'active' | 'inactive' | 'learning';

// Specialized Agent Input Types
export interface NutritionData {
  meals?: Array<{
    name: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    time?: string;
  }>;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
}

export interface TrainingData {
  type?: 'strength' | 'cardio' | 'flexibility' | 'sports' | 'mixed';
  duration?: number; // minutes
  exercises?: Array<{
    name: string;
    sets?: number;
    reps?: number;
    weight?: number;
    duration?: number;
  }>;
  intensity?: 'low' | 'moderate' | 'high' | 'very_high';
  caloriesBurned?: number;
}

export interface SleepData {
  duration?: number; // hours
  quality?: number; // 1-5
  bedtime?: string;
  wakeTime?: string;
  interruptions?: number;
  notes?: string;
}

export interface EnergyData {
  level?: number; // 1-5
  time?: 'morning' | 'afternoon' | 'evening' | 'night';
  mood?: 'great' | 'good' | 'neutral' | 'low' | 'bad';
  stressLevel?: number; // 1-5
  notes?: string;
}

export interface Agent {
  id: string;
  type: AgentType;
  config: Record<string, unknown>;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentDTO {
  type: AgentType;
  config?: Record<string, unknown>;
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
  | 'weight_log'
  | 'meal_log'
  | 'workout_log'
  | 'sleep_log'
  | 'energy_check'
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
  novaPointsEarned?: number;
}

export interface ProcessMessageRequest {
  userId: string;
  content: string;
  imageUrl?: string;
  messageType?: MessageType;
}

export interface ProcessMessageResponse {
  success: boolean;
  response: FinalResponse;
  intent: MessageIntent;
  processedAt: Date;
}
