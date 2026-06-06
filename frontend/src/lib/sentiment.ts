// In-the-moment shopper feeling → color + label, for mood cues across the UI.
export type Sentiment = "love" | "like" | "neutral" | "dislike" | "reject";

export function sentimentColor(s?: Sentiment): string | undefined {
  switch (s) {
    case "love":
      return "oklch(0.8 0.15 145)"; // green
    case "like":
      return "oklch(0.8 0.13 160)"; // teal-green
    case "neutral":
      return "oklch(0.72 0.03 90)"; // muted
    case "dislike":
      return "oklch(0.78 0.14 60)"; // amber
    case "reject":
      return "oklch(0.72 0.16 25)"; // red
    default:
      return undefined;
  }
}

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  love: "Loves it",
  like: "Likes it",
  neutral: "Neutral",
  dislike: "Unsure",
  reject: "Turned off",
};
