// One cell in the heatmap grid
export interface HeatmapDay {
  date: string; // ISO date string "YYYY-MM-DD"
  count: number; // total contribution value (can be decimal e.g. 0.5)
  intensity: number; // 0-5
  types: {
    solo: number;
    room: number;
    quests: number;
  };
}

// Profile stats shown below the heatmap grid
export interface HeatmapStats {
  totalContributions: number; // sum of all counts in last 365 days
  currentStreak: number; // from user_preferences
  longestStreak: number; // from user_preferences
  activeDays: number; // days where count > 0 in last 365 days
}

// Full API response shape
export interface HeatmapResponse {
  userId: string;
  days: HeatmapDay[]; // always 365 entries, missing days filled with zeros
  stats: HeatmapStats;
  breakdown: {
    solo: number; // total solo contributions
    room: number; // total room contributions
    quests: number; // total quest contributions
  };
}
