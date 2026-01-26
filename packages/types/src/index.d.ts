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
export type Sex = 'male' | 'female' | 'other';
export type Objective = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'energy' | 'sleep' | 'stress';
export interface Profile {
    id: string;
    userId: string;
    weight: number;
    height: number;
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
export type AgentType = 'coach' | 'analyst' | 'planner' | 'motivator';
export type AgentStatus = 'active' | 'inactive' | 'learning';
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
export interface HealthCheck {
    status: 'ok' | 'error';
    timestamp: Date;
    services: {
        database: boolean;
        cache?: boolean;
    };
}
export type MessageType = 'text' | 'image' | 'weight' | 'sleep' | 'meal' | 'workout' | 'energy';
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
export type MessageIntent = 'weight_log' | 'meal_log' | 'workout_log' | 'sleep_log' | 'energy_check' | 'question' | 'greeting' | 'general';
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
//# sourceMappingURL=index.d.ts.map