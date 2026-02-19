-- Fix Infinite Recursion in RLS Policies

-- The issue: 
-- 1. 'events' policy queries 'event_participants' to check if user is invited.
-- 2. 'event_participants' policy queries 'events' to check if user is the creator.
-- 3. This creates an infinite loop.

-- The solution:
-- Create a helper function with SECURITY DEFINER to check event ownership.
-- This bypasses RLS on the 'events' table when checking ownership, breaking the loop.

CREATE OR REPLACE FUNCTION public.is_event_creator(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = _event_id
    AND created_by = auth.uid()
  );
$$;

-- Update policies on event_participants to use the new function

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Event creators can view participants" ON public.event_participants;
    DROP POLICY IF EXISTS "Event creators can insert participants" ON public.event_participants;
    DROP POLICY IF EXISTS "Event creators can delete participants" ON public.event_participants;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Event creators can view participants" ON public.event_participants
    FOR SELECT USING (
        is_event_creator(event_id)
    );

CREATE POLICY "Event creators can insert participants" ON public.event_participants
    FOR INSERT WITH CHECK (
        is_event_creator(event_id)
    );

CREATE POLICY "Event creators can delete participants" ON public.event_participants
    FOR DELETE USING (
        is_event_creator(event_id)
    );
