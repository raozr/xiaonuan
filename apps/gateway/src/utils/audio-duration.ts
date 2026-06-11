const WAV_HEADER_BYTES = 44;
const PCM_16_MONO_BYTES_PER_SECOND_AT_16KHZ = 16_000 * 2;

export function estimatePcm16MonoDurationSec(byteLength: number): number {
  const payloadBytes = Math.max(0, byteLength - WAV_HEADER_BYTES);
  const duration = payloadBytes / PCM_16_MONO_BYTES_PER_SECOND_AT_16KHZ;
  return Math.round(duration * 100) / 100;
}
