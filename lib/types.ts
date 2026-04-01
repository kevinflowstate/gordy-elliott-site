export type UserRole = 'client' | 'admin';
export type TrafficLight = 'green' | 'amber' | 'red';
export type ModuleStatus = 'locked' | 'in_progress' | 'completed';
export type ContentType = 'video' | 'pdf' | 'text' | 'checklist';
export type CheckInMood = 'great' | 'good' | 'okay' | 'struggling' | string;

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface ClientProfile {
  id: string;
  user_id: string;
  phone?: string;
  business_name?: string;
  business_type?: string;
  goals?: string;
  primary_goal?: string;
  target_date?: string;
  goal_notes?: string;
  start_date: string;
  status: TrafficLight;
  notes?: string;
  last_login?: string;
  last_checkin?: string;
  created_at: string;
  user?: User;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  order_index: number;
  thumbnail_url?: string;
  is_published: boolean;
  created_at: string;
  content?: ModuleContent[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'sheet' | 'doc' | 'image' | 'other';
  size?: string;
}

export interface ModuleContent {
  id: string;
  module_id: string;
  title: string;
  content_type: ContentType;
  content_url?: string;
  content_text?: string;
  order_index: number;
  duration_minutes?: number;
  attachments?: Attachment[];
  created_at: string;
}

export interface ClientModule {
  id: string;
  client_id: string;
  module_id: string;
  status: ModuleStatus;
  started_at?: string;
  completed_at?: string;
  module?: TrainingModule;
}

export interface ContentProgress {
  id: string;
  client_id: string;
  content_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface CheckIn {
  id: string;
  client_id: string;
  week_number: number;
  mood: CheckInMood;
  wins?: string;
  challenges?: string;
  questions?: string;
  responses?: Record<string, string>;
  admin_reply?: string;
  replied_at?: string;
  created_at: string;
  client?: ClientProfile;
}

export interface TrainingPlanItem {
  id: string;
  category: string;
  title: string;
  completed: boolean;
  completed_at?: string;
}

export interface TrainingPlanPhase {
  id: string;
  name: string;
  notes: string;
  order_index: number;
  items: TrainingPlanItem[];
  linked_trainings: string[];
}

export interface TrainingPlan {
  id: string;
  client_id: string;
  summary: string;
  status: 'active' | 'completed';
  created_at: string;
  completed_at?: string;
  phases: TrainingPlanPhase[];
  discovery_answers?: Record<string, string>;
  pdf_url?: string;
}

// Legacy alias for DB compatibility
export type BusinessPlan = TrainingPlan;

export interface DemoClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  business_name: string;
  business_type: string;
  goals: string;
  start_date: string;
  status: TrafficLight;
  current_week: number;
  last_login: string;
  last_checkin: string;
  checkins: CheckIn[];
  training_plan: TrainingPlan[];
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  created_at: string;
}

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time: string;
  recurrence: RecurrenceType;
  recurrence_day?: number;
  link?: string;
  link_label?: string;
  is_active: boolean;
  created_at: string;
}

// Form config types
export interface FormQuestion {
  id: string;
  label: string;
  placeholder: string;
  type: 'textarea' | 'text' | 'select' | 'file';
  options?: string[];
  enabled?: boolean;
  required?: boolean;
}

export interface MoodOption {
  value: string;
  label: string;
  color: string;
}

export interface ProgressMetric {
  id: string;
  label: string;
  type: 'number' | 'scale';
  unit?: string;
  min?: number;
  max?: number;
  enabled: boolean;
}

export interface CheckinFormConfig {
  title?: string;
  checkin_day: string;
  mood_enabled: boolean;
  mood_options: MoodOption[];
  questions: FormQuestion[];
  progress_tracking?: ProgressMetric[];
}

export interface TrainingPlanFormConfig {
  questions: FormQuestion[];
}

// ============================================
// Exercise Plan Types
// ============================================

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  description?: string;
  video_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface ExerciseSessionItem {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise?: Exercise;
  order_index: number;
  sets: number;
  reps: string;
  rest_seconds?: number;
  tempo?: string;
  notes?: string;
  section_label?: string;
  superset_group?: string;
}

export interface ExerciseSession {
  id: string;
  template_id?: string;
  plan_id?: string;
  name: string;
  day_number: number;
  notes?: string;
  items: ExerciseSessionItem[];
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  description?: string;
  overview?: string;
  tags?: string[];
  category: string;
  duration_weeks?: number;
  is_active: boolean;
  sessions: ExerciseSession[];
  created_at: string;
  updated_at: string;
}

export interface ClientExercisePlan {
  id: string;
  client_id: string;
  template_id?: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  start_date?: string;
  end_date?: string;
  sessions: ExerciseSession[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Nutrition Plan Types
// ============================================

export interface Food {
  id: string;
  name: string;
  category: string;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g?: number;
  photo_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface NutritionMealItem {
  id: string;
  meal_id: string;
  food_id: string;
  food?: Food;
  quantity: number;
  order_index: number;
  notes?: string;
}

export interface NutritionMeal {
  id: string;
  template_id?: string;
  plan_id?: string;
  name: string;
  order_index: number;
  notes?: string;
  items: NutritionMealItem[];
}

export interface NutritionTemplate {
  id: string;
  name: string;
  description?: string;
  calorie_range: string;
  plan_type?: 'full' | 'macro_only';
  target_calories?: number;
  target_protein_g?: number;
  target_carbs_g?: number;
  target_fat_g?: number;
  is_active: boolean;
  meals: NutritionMeal[];
  created_at: string;
  updated_at: string;
}

export interface MealAlternative {
  id: string;
  name: string;
  items: NutritionMealItem[];
}

export interface ClientNutritionPlan {
  id: string;
  client_id: string;
  template_id?: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  target_calories?: number;
  target_protein_g?: number;
  target_carbs_g?: number;
  target_fat_g?: number;
  start_date?: string;
  meals: NutritionMeal[];
  created_at: string;
  updated_at: string;
}

export interface MealTracking {
  id: string;
  client_id: string;
  meal_id: string;
  tracked_date: string;
  completed: boolean;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ============================================
// Body Measurement Types
// ============================================

export interface BodyMeasurement {
  id: string;
  client_id: string;
  measured_date: string;
  weight_kg?: number;
  height_cm?: number;
  body_fat_percent?: number;
  chest_cm?: number;
  waist_cm?: number;
  hip_cm?: number;
  notes?: string;
  created_at: string;
}

// ============================================
// Personal Meal Types (Client-created)
// ============================================

export interface QuickMeal {
  id: string;
  client_id: string;
  tracked_date: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  completed: boolean;
  created_at: string;
}

export interface ClientSavedMeal {
  id: string;
  client_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}
