-- Prevent multiple open cash registers for the same user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_cash_register_per_user
ON public.cash_registers (user_id)
WHERE status = 'open';