CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'client')),
  message TEXT NOT NULL,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_client_created
  ON public.inbox_messages(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_admin_unread
  ON public.inbox_messages(sender_role, read_by_admin, created_at DESC)
  WHERE sender_role = 'client';

CREATE INDEX IF NOT EXISTS idx_inbox_messages_client_unread
  ON public.inbox_messages(client_id, sender_role, read_by_client, created_at DESC)
  WHERE sender_role = 'admin';

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.inbox_messages TO authenticated;

CREATE POLICY "Admins can manage all inbox messages" ON public.inbox_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY "Clients can view own inbox messages" ON public.inbox_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = inbox_messages.client_id
        AND client_profiles.user_id = auth.uid()
    )
  );
