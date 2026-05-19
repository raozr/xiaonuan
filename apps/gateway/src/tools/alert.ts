export async function emergencyAlert(
  severity: 'HIGH' | 'CRITICAL',
  reason: string,
  pairingId: string
) {
  // TODO: Implement actual SMS / Push notification to children
  console.warn(
    `[EMERGENCY_ALERT] [Pairing: ${pairingId}] [Severity: ${severity}] Reason: ${reason}`
  );

  // Fallback / mock implementation:
  return {
    success: true,
    message: 'Alert has been logged and queued for notification.',
  };
}
