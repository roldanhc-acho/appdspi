-- =============================================================
-- FIX: Allow event participants to see private events
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1. Drop ALL existing SELECT policies on events to start clean
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
DROP POLICY IF EXISTS "Users can view public events" ON public.events;
DROP POLICY IF EXISTS "Users can view events they are invited to" ON public.events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
DROP POLICY IF EXISTS "events_select_policy" ON public.events;
DROP POLICY IF EXISTS "events_insert_policy" ON public.events;
DROP POLICY IF EXISTS "events_update_policy" ON public.events;
DROP POLICY IF EXISTS "events_delete_policy" ON public.events;

-- 2. Ensure RLS is enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. Create a SINGLE unified SELECT policy for events
-- This avoids circular reference issues by combining all conditions in one policy
CREATE POLICY "events_select_policy" ON public.events
    FOR SELECT USING (
        is_public = true
        OR created_by = auth.uid()
        OR id IN (
            SELECT event_id FROM public.event_participants 
            WHERE user_id = auth.uid()
        )
    );

-- 4. INSERT: only creators
CREATE POLICY "events_insert_policy" ON public.events
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 5. UPDATE: only creators
CREATE POLICY "events_update_policy" ON public.events
    FOR UPDATE USING (auth.uid() = created_by);

-- 6. DELETE: only creators
CREATE POLICY "events_delete_policy" ON public.events
    FOR DELETE USING (auth.uid() = created_by);


-- =============================================================
-- Fix event_participants policies too
-- =============================================================
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.event_participants;
DROP POLICY IF EXISTS "Event creators can view participants" ON public.event_participants;
DROP POLICY IF EXISTS "Event creators can insert participants" ON public.event_participants;
DROP POLICY IF EXISTS "Event creators can delete participants" ON public.event_participants;
DROP POLICY IF EXISTS "participants_select_policy" ON public.event_participants;
DROP POLICY IF EXISTS "participants_insert_policy" ON public.event_participants;
DROP POLICY IF EXISTS "participants_delete_policy" ON public.event_participants;

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- SELECT: participants can see their own entries, creators can see their event's participants
CREATE POLICY "participants_select_policy" ON public.event_participants
    FOR SELECT USING (
        user_id = auth.uid()
        OR event_id IN (
            SELECT id FROM public.events 
            WHERE created_by = auth.uid()
        )
    );

-- INSERT: only event creators can add participants
CREATE POLICY "participants_insert_policy" ON public.event_participants
    FOR INSERT WITH CHECK (
        event_id IN (
            SELECT id FROM public.events 
            WHERE created_by = auth.uid()
        )
    );

-- DELETE: only event creators can remove participants
CREATE POLICY "participants_delete_policy" ON public.event_participants
    FOR DELETE USING (
        event_id IN (
            SELECT id FROM public.events 
            WHERE created_by = auth.uid()
        )
    );
