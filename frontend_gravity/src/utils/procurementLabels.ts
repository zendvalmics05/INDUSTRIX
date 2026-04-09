export const getConsistencyLabel = (sigma: number): { text: string; color: string } => {
  if (sigma < 4) return { text: "High Stability", color: "text-primary" };
  if (sigma < 8) return { text: "Standard", color: "text-on-surface" };
  if (sigma < 15) return { text: "Noticeable Variance", color: "text-on-surface-variant" };
  if (sigma < 25) return { text: "Barely Consistent", color: "text-tertiary" };
  return { text: "Total Gambling", color: "text-error" };
};

export const getTransportSpreadLabel = (sigmaAdd: number): { text: string; color: string } => {
  if (sigmaAdd < 2) return { text: "Precise", color: "text-primary" };
  if (sigmaAdd < 5) return { text: "Reliable", color: "text-on-surface" };
  if (sigmaAdd < 10) return { text: "Bumpy", color: "text-on-surface-variant" };
  if (sigmaAdd < 18) return { text: "Traumatic", color: "text-tertiary" };
  return { text: "Chaotic", color: "text-error" };
};
