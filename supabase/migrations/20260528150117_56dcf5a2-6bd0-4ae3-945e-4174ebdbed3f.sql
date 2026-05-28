
REVOKE EXECUTE ON FUNCTION public.get_effective_user_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_blocked(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_member_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_barcode_scan_logs() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_effective_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
