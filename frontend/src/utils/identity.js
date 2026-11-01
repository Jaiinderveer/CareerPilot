export function getDisplayName(user, profile) {
  if (profile?.full_name?.trim()) return profile.full_name.trim()
  if (user?.user_metadata?.full_name?.trim()) return user.user_metadata.full_name.trim()
  if (user?.user_metadata?.name?.trim()) return user.user_metadata.name.trim()
  if (user?.email) return user.email.split('@')[0]
  return 'Student'
}
