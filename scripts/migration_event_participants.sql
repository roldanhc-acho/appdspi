-- Create event_participants table
CREATE TABLE IF NOT EXISTS public.event_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- Allow invited users to view the event itself (if private)
-- Note: This requires updating policies on the `events` table, which might be complex to do blindly.
-- For now, we assume RLS on `events` allows seeing events you are invited to, or we handle it via application logic if RLS is effectively "owner only" for private events.
-- A common pattern for `events` check is:
-- (is_public = true) OR (created_by = auth.uid()) OR (id IN (SELECT event_id FROM event_participants WHERE user_id = auth.uid()))
