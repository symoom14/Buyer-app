export function getStatusColors(colors, isDark) {
  return {
    pending: isDark ? colors.warning : "#FFB300",
    accepted: isDark ? colors.tint : "#2196F3",
    completed: isDark ? colors.success : "#4CAF50",
    cancelled: isDark ? colors.danger : "#F44336",
  };
}
