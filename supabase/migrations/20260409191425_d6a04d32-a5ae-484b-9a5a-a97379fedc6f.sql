
-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can view own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can update own cash registers" ON public.cash_registers;
DROP POLICY IF EXISTS "Users can delete own cash registers" ON public.cash_registers;

-- SELECT: user can see their own registers (by actual user_id), master's registers (via effective id), or master can see vendor registers
CREATE POLICY "Users can view own cash registers" ON public.cash_registers
FOR SELECT USING (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- INSERT: user can insert for themselves, or master can insert for their vendors
CREATE POLICY "Users can insert own cash registers" ON public.cash_registers
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- UPDATE: same logic
CREATE POLICY "Users can update own cash registers" ON public.cash_registers
FOR UPDATE USING (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);

-- DELETE: same logic
CREATE POLICY "Users can delete own cash registers" ON public.cash_registers
FOR DELETE USING (
  user_id = auth.uid()
  OR user_id = get_effective_user_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.user_id = cash_registers.user_id
      AND company_members.owner_id = auth.uid()
      AND company_members.active = true
  )
);
