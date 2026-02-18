-- Comprehensive RLS fix for Events and Participants

-- 1. Ensure RLS is enabled on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts/corruption (safest approach for a fix script)
-- We use DO blocks to avoid errors if policies don't exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
    DROP POLICY IF EXISTS "Users can view public events" ON public.events;
    DROP POLICY IF EXISTS "Users can view events they are invited to" ON public.events;
    DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
    DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
    DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- 3. Re-create standard policies for events

-- Policy: Creators can view their own events (CRITICAL for not losing your events)
CREATE POLICY "Users can view their own events" ON public.events
    FOR SELECT USING (auth.uid() = created_by);

-- Policy: Everyone can view public events
CREATE POLICY "Users can view public events" ON public.events
    FOR SELECT USING (is_public = true);

-- Policy: Invited users can view private events
CREATE POLICY "Users can view events they are invited to" ON public.events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.event_participants 
            WHERE event_id = id 
            AND user_id = auth.uid()
        )
    );

-- Policy: Creators can insert events
CREATE POLICY "Users can insert their own events" ON public.events
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Policy: Creators can update their own events
CREATE POLICY "Users can update their own events" ON public.events
    FOR UPDATE USING (auth.uid() = created_by);

-- Policy: Creators can delete their own events
CREATE POLICY "Users can delete their own events" ON public.events
    FOR DELETE USING (auth.uid() = created_by);


-- 4. Ensure event_participants policies are also correct (optional but good for safety)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own invitations" ON public.event_participants;
    DROP POLICY IF EXISTS "Event creators can view participants" ON public.event_participants;
    DROP POLICY IF EXISTS "Event creators can insert participants" ON public.event_participants;
    DROP POLICY IF EXISTS "Event creators can delete participants" ON public.event_participants;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Users can view their own invitations" ON public.event_participants
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Event creators can view participants" ON public.event_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE id = event_participants.event_id 
            AND created_by = auth.uid()
        )
    );

CREATE POLICY "Event creators can insert participants" ON public.event_participants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE id = event_id 
            AND created_by = auth.uid()
        )
    );

CREATE POLICY "Event creators can delete participants" ON public.event_participants
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE id = event_id 
            AND created_by = auth.uid()
        )
    );
