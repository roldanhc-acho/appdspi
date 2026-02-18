-- Allow invited users to view the private events they are invited to.

-- Drop existing SELECT policy if it exists (assuming standard naming or recreate)
-- Note: Since we don't know the exact name of the existing policy (e.g., "Users can view their own events" or "Enable read access for all users"), we will create a NEW policy specifically for invitations.
-- Policies are additive (OR logic), so adding this policy will work alongside existing ones.

CREATE POLICY "Users can view events they are invited to" ON public.events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.event_participants 
            WHERE event_id = id 
            AND user_id = auth.uid()
        )
    );
