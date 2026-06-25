
REVOKE EXECUTE ON FUNCTION public.can_emit_nfce(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_emit_nfce(uuid) TO authenticated, service_role;
