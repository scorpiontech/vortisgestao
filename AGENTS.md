# Architecture rules
- Store optional bill suppliers as tenant-validated foreign keys so accounts retain their selected supplier safely.
- Capture the authenticated attendant and original cash session at sale or PDV charge creation; carry charge attribution through payment settlement so delayed payments retain their original operator.
- Build the daily PDV product report from sale items grouped by local day, cash session and attendant IDs; leave historical missing attribution explicit rather than infer an operator from the tenant owner.