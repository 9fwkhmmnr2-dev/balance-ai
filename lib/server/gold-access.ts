export function isGoldEnabledForUser(user: { id: string; app_metadata?: Record<string, unknown> | null }) {
  const metadataGold = user.app_metadata?.plan === "gold" && user.app_metadata?.gold_active === true;
  const previewAllowlist = process.env.VERCEL_ENV === "preview" &&
    Boolean(process.env.VERA_GOLD_PREVIEW_USER_ID) &&
    process.env.VERA_GOLD_PREVIEW_USER_ID === user.id;
  return metadataGold || previewAllowlist;
}
