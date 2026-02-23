export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            absences: {
                Row: {
                    attachment_url: string | null
                    created_at: string | null
                    end_date: string
                    hours: number | null
                    id: string
                    reason: string | null
                    start_date: string
                    status: Database["public"]["Enums"]["absence_status"] | null
                    type: Database["public"]["Enums"]["absence_type"]
                    user_id: string
                }
                Insert: {
                    attachment_url?: string | null
                    created_at?: string | null
                    end_date: string
                    hours?: number | null
                    id?: string
                    reason?: string | null
                    start_date: string
                    status?: Database["public"]["Enums"]["absence_status"] | null
                    type: Database["public"]["Enums"]["absence_type"]
                    user_id: string
                }
                Update: {
                    attachment_url?: string | null
                    created_at?: string | null
                    end_date?: string
                    hours?: number | null
                    id?: string
                    reason?: string | null
                    start_date?: string
                    status?: Database["public"]["Enums"]["absence_status"] | null
                    type?: Database["public"]["Enums"]["absence_type"]
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "absences_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            client_assignments: {
                Row: {
                    assigned_at: string | null
                    client_id: string
                    id: string
                    user_id: string
                }
                Insert: {
                    assigned_at?: string | null
                    client_id: string
                    id?: string
                    user_id: string
                }
                Update: {
                    assigned_at?: string | null
                    client_id?: string
                    id?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "client_assignments_client_id_fkey"
                        columns: ["client_id"]
                        isOneToOne: false
                        referencedRelation: "clients"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "client_assignments_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            clients: {
                Row: {
                    contact_info: string | null
                    created_at: string | null
                    id: string
                    name: string
                }
                Insert: {
                    contact_info?: string | null
                    created_at?: string | null
                    id?: string
                    name: string
                }
                Update: {
                    contact_info?: string | null
                    created_at?: string | null
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            event_participants: {
                Row: {
                    created_at: string
                    event_id: string
                    id: string
                    status: string | null
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    event_id: string
                    id?: string
                    status?: string | null
                    user_id: string
                }
                Update: {
                    created_at?: string
                    event_id?: string
                    id?: string
                    status?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "event_participants_event_id_fkey"
                        columns: ["event_id"]
                        isOneToOne: false
                        referencedRelation: "events"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "event_participants_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            events: {
                Row: {
                    created_at: string | null
                    created_by: string
                    description: string | null
                    event_date: string
                    event_time: string | null
                    id: string
                    is_public: boolean
                    recurrence: string | null
                    title: string
                }
                Insert: {
                    created_at?: string | null
                    created_by: string
                    description?: string | null
                    event_date: string
                    event_time?: string | null
                    id?: string
                    is_public?: boolean
                    recurrence?: string | null
                    title: string
                }
                Update: {
                    created_at?: string | null
                    created_by?: string
                    description?: string | null
                    event_date?: string
                    event_time?: string | null
                    id?: string
                    is_public?: boolean
                    recurrence?: string | null
                    title?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "events_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    created_at: string | null
                    department: string | null
                    full_name: string | null
                    hourly_rate: number | null
                    id: string
                    role: Database["public"]["Enums"]["user_role"] | null
                }
                Insert: {
                    avatar_url?: string | null
                    created_at?: string | null
                    department?: string | null
                    full_name?: string | null
                    hourly_rate?: number | null
                    id: string
                    role?: Database["public"]["Enums"]["user_role"] | null
                }
                Update: {
                    avatar_url?: string | null
                    created_at?: string | null
                    department?: string | null
                    full_name?: string | null
                    hourly_rate?: number | null
                    id?: string
                    role?: Database["public"]["Enums"]["user_role"] | null
                }
                Relationships: []
            }
            project_assignments: {
                Row: {
                    assigned_at: string | null
                    id: string
                    project_id: string
                    user_id: string
                }
                Insert: {
                    assigned_at?: string | null
                    id?: string
                    project_id: string
                    user_id: string
                }
                Update: {
                    assigned_at?: string | null
                    id?: string
                    project_id?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "project_assignments_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "project_assignments_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            projects: {
                Row: {
                    client_id: string
                    created_at: string | null
                    description: string | null
                    end_date: string | null
                    id: string
                    name: string
                    start_date: string | null
                    status: string | null
                }
                Insert: {
                    client_id: string
                    created_at?: string | null
                    description?: string | null
                    end_date?: string | null
                    id?: string
                    name: string
                    start_date?: string | null
                    status?: string | null
                }
                Update: {
                    client_id?: string
                    created_at?: string | null
                    description?: string | null
                    end_date?: string | null
                    id?: string
                    name?: string
                    start_date?: string | null
                    status?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "projects_client_id_fkey"
                        columns: ["client_id"]
                        isOneToOne: false
                        referencedRelation: "clients"
                        referencedColumns: ["id"]
                    },
                ]
            }
            tasks: {
                Row: {
                    assigned_to: string | null
                    client_id: string | null
                    created_at: string | null
                    description: string | null
                    due_date: string | null
                    estimated_hours: number | null
                    id: string
                    parent_task_id: string | null
                    priority: string | null
                    project_id: string | null
                    start_date: string | null
                    status: Database["public"]["Enums"]["task_status"] | null
                    title: string
                    updated_at: string | null
                }
                Insert: {
                    assigned_to?: string | null
                    client_id?: string | null
                    created_at?: string | null
                    description?: string | null
                    due_date?: string | null
                    estimated_hours?: number | null
                    id?: string
                    parent_task_id?: string | null
                    priority?: string | null
                    project_id?: string | null
                    start_date?: string | null
                    status?: Database["public"]["Enums"]["task_status"] | null
                    title: string
                    updated_at?: string | null
                }
                Update: {
                    assigned_to?: string | null
                    client_id?: string | null
                    created_at?: string | null
                    description?: string | null
                    due_date?: string | null
                    estimated_hours?: number | null
                    id?: string
                    parent_task_id?: string | null
                    priority?: string | null
                    project_id?: string | null
                    start_date?: string | null
                    status?: Database["public"]["Enums"]["task_status"] | null
                    title?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "tasks_assigned_to_fkey"
                        columns: ["assigned_to"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tasks_client_id_fkey"
                        columns: ["client_id"]
                        isOneToOne: false
                        referencedRelation: "clients"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tasks_parent_task_id_fkey"
                        columns: ["parent_task_id"]
                        isOneToOne: false
                        referencedRelation: "tasks"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tasks_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                ]
            }
            task_assignments: {
                Row: {
                    id: string
                    task_id: string
                    user_id: string
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    task_id: string
                    user_id: string
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    task_id?: string
                    user_id?: string
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "task_assignments_task_id_fkey"
                        columns: ["task_id"]
                        isOneToOne: false
                        referencedRelation: "tasks"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "task_assignments_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            time_logs: {
                Row: {
                    created_at: string | null
                    date: string
                    hours_worked: number
                    id: string
                    notes: string | null
                    task_id: string | null
                    type: Database["public"]["Enums"]["log_type"] | null
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    date?: string
                    hours_worked: number
                    id?: string
                    notes?: string | null
                    task_id?: string | null
                    type?: Database["public"]["Enums"]["log_type"] | null
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    date?: string
                    hours_worked?: number
                    id?: string
                    notes?: string | null
                    task_id?: string | null
                    type?: Database["public"]["Enums"]["log_type"] | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "time_logs_task_id_fkey"
                        columns: ["task_id"]
                        isOneToOne: false
                        referencedRelation: "tasks"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "time_logs_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            productive_hours: {
                Row: {
                    client_id: string
                    created_at: string | null
                    created_by: string
                    hours: number
                    id: string
                    month: string
                    user_id: string
                }
                Insert: {
                    client_id: string
                    created_at?: string | null
                    created_by: string
                    hours?: number
                    id?: string
                    month: string
                    user_id: string
                }
                Update: {
                    client_id?: string
                    created_at?: string | null
                    created_by?: string
                    hours?: number
                    id?: string
                    month?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "productive_hours_client_id_fkey"
                        columns: ["client_id"]
                        isOneToOne: false
                        referencedRelation: "clients"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "productive_hours_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "productive_hours_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            hour_bank: {
                Row: {
                    id: string
                    user_id: string
                    month: string
                    hours_saved: number
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    month: string
                    hours_saved?: number
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    month?: string
                    hours_saved?: number
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "hour_bank_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            is_admin: {
                Args: Record<PropertyKey, never>
                Returns: boolean
            }
        }
        Enums: {
            absence_status: "pending" | "approved" | "rejected"
            absence_type: "vacation" | "sickness" | "study" | "other" | "suspension"
            log_type: "regular" | "overtime"
            task_status: "pending" | "in_progress" | "review" | "finished" | "cancelled"
            user_role: "admin" | "employee"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? (DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? DatabaseWithoutInternals[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProductiveHours = Database["public"]["Tables"]["productive_hours"]["Row"]

export const Constants = {
    public: {
        Enums: {
            absence_status: ["pending", "approved", "rejected"],
            absence_type: ["vacation", "sickness", "study", "other", "suspension"],
            log_type: ["regular", "overtime"],
            task_status: ["pending", "in_progress", "review", "finished", "cancelled"],
            user_role: ["admin", "employee"],
        },
    },
} as const
