export function comfortLabel(temp: number, humidity: number) {
  if (temp < 17) return "Cool";
  if (temp > 25) return "Warm";
  if (humidity > 70) return "Humid";
  if (temp >= 19 && temp <= 23 && humidity <= 55) return "Comfortable";
  return "Comfortable";
}
