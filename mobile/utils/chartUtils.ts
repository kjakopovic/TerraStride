export const createBalanceChartData = (primaryColor: string) => ({
  labels: Array(6).fill(""),
  datasets: [
    {
      data: [14.3, 11.8, 12.6, 12.1, 12.9, 12.4],
      color: () => primaryColor,
      strokeWidth: 2,
    },
  ],
});

export const createBalanceChartConfig = (
  backgroundColor: string,
  primaryColor: string
) => ({
  backgroundGradientFrom: backgroundColor,
  backgroundGradientTo: backgroundColor,
  color: () => primaryColor,
  fillShadowGradient: primaryColor,
  fillShadowGradientOpacity: 0.2,
  propsForDots: { r: "0" },
  propsForBackgroundLines: { stroke: "transparent" },
});
