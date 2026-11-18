export const stageScaleForViewport = (width: number): number => {
  if (width < 400) return 0.82;
  if (width < 720) return 0.9;
  return 1;
};