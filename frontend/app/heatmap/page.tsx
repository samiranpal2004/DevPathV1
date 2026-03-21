'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Navbar } from '@/components/Navbar';
import {
  getMyHeatmap,
  getFilteredIntensity,
  type HeatmapPayload,
  type HeatmapDay,
  type FilterMode,
} from '@/lib/api/heatmap';

const INTENSITY_COLORS = [
  'bg-surface-container-highest/60', // 0 — no activity
  'bg-yellow-300/80',                // 1 — low
  'bg-amber-400',                    // 2
  'bg-orange-500',                   // 3
  'bg-red-500',                      // 4 — high
];

const SPECIAL_COLORS: Record<string, string> = {
  room_win: 'bg-cyan-500',
  streak_milestone: 'bg-yellow-500',
  level_up: 'bg-blue-500',
  perfect_day: 'bg-purple-500',
};

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All Activity' },
  { key: 'solo', label: 'Solo' },
  { key: 'room', label: 'Room Battles' },
  { key: 'quests', label: 'Quests' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getSpecialColor(day: HeatmapDay): string | null {
  if (day.intensity === 5) return SPECIAL_COLORS.perfect_day;
  if (day.types.room >= 2) return SPECIAL_COLORS.room_win;
  return null;
}

function getCellColor(day: HeatmapDay, filter: FilterMode): string {
  const special = getSpecialColor(day);
  if (special && filter === 'all') return special;

  const intensity = getFilteredIntensity(day, filter);
  return INTENSITY_COLORS[intensity];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** Builds 53 columns of 7 rows from the 365-day flat array, aligned to weekday start. */
function buildGrid(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (days.length === 0) return [];

  const firstDow = new Date(days[0].date + 'T00:00:00').getDay();
  const padded: (HeatmapDay | null)[] = Array(firstDow).fill(null).concat(days);

  const columns: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    const week = padded.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    columns.push(week);
  }

  return columns;
}

/** Determine which month labels to show above the grid. */
function getMonthPositions(columns: (HeatmapDay | null)[][]): { col: number; label: string }[] {
  const positions: { col: number; label: string }[] = [];
  let lastMonth = -1;

  for (let c = 0; c < columns.length; c++) {
    const day = columns[c].find((d) => d !== null);
    if (!day) continue;
    const month = new Date(day.date + 'T00:00:00').getMonth();
    if (month !== lastMonth) {
      positions.push({ col: c, label: MONTH_LABELS[month] });
      lastMonth = month;
    }
  }

  return positions;
}

export default function HeatmapPage() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<HeatmapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getMyHeatmap();
      setData(payload);
    } catch (err) {
      console.error('Failed to fetch heatmap:', err);
      setError('Failed to load heatmap data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user) {
      fetchHeatmap();
    }
  }, [isLoaded, user, fetchHeatmap]);

  const columns = data ? buildGrid(data.days) : [];
  const monthPositions = getMonthPositions(columns);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-on-background">Activity Heatmap</h1>
            <p className="text-on-surface-variant/60 mt-1">Your coding consistency and milestone achievements.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === opt.key
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-20">
            <p className="text-error mb-4">{error}</p>
            <button onClick={fetchHeatmap} className="px-4 py-2 bg-surface-container-low text-on-background rounded-lg hover:bg-surface-container-highest">
              Retry
            </button>
          </div>
        )}

        {/* Heatmap grid */}
        {data && !loading && (
          <>
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-[0_20px_50px_rgba(63,72,73,0.04)]">
              {/* Top accent line */}
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500" />

              <div className="flex gap-3">
                {/* Day labels */}
                <div className="flex flex-col justify-between text-[10px] text-on-surface-variant/50 font-medium py-1 shrink-0" style={{ height: `${7 * 14 + 6 * 3}px` }}>
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-x-auto">
                  {/* Month labels */}
                  <div className="relative h-4 mb-1" style={{ minWidth: `${columns.length * 17}px` }}>
                    {monthPositions.map((mp) => (
                      <span
                        key={mp.col}
                        className="absolute text-[10px] text-on-surface-variant/50 font-medium"
                        style={{ left: `${mp.col * 17}px` }}
                      >
                        {mp.label}
                      </span>
                    ))}
                  </div>

                  {/* Cells */}
                  <div
                    className="grid gap-[3px]"
                    style={{
                      gridTemplateColumns: `repeat(${columns.length}, 14px)`,
                      gridTemplateRows: 'repeat(7, 14px)',
                      minWidth: `${columns.length * 17}px`,
                    }}
                  >
                    {columns.map((week, colIdx) =>
                      week.map((day, rowIdx) => {
                        if (!day) {
                          return <div key={`${colIdx}-${rowIdx}`} className="w-[14px] h-[14px]" />;
                        }
                        const color = getCellColor(day, filter);
                        return (
                          <div
                            key={day.date}
                            className={`w-[14px] h-[14px] rounded-sm ${color} cursor-pointer hover:ring-1 hover:ring-on-background/20 transition-all`}
                            style={{ gridColumn: colIdx + 1, gridRow: rowIdx + 1 }}
                            onMouseEnter={(e) => {
                              setHoveredDay(day);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                            }}
                            onMouseLeave={() => {
                              setHoveredDay(null);
                              setTooltipPos(null);
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-3 mt-6 text-xs text-on-surface-variant/50 font-medium flex-wrap">
                <span>Less</span>
                <div className="flex gap-1">
                  {INTENSITY_COLORS.map((c, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                  ))}
                </div>
                <span>More</span>
                <div className="w-px h-3 bg-outline-variant/20 mx-1" />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-cyan-500" />
                    <span>Room Win</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-purple-500" />
                    <span>Perfect Day</span>
                  </div>
                </div>
              </div>

              {/* Tooltip */}
              {hoveredDay && tooltipPos && (
                <div
                  className="fixed z-50 bg-on-background text-surface text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none"
                  style={{
                    left: tooltipPos.x,
                    top: tooltipPos.y,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <p className="font-semibold">{formatDate(hoveredDay.date)}</p>
                  <p className="text-surface-container-highest mt-0.5">
                    {hoveredDay.count > 0
                      ? `${hoveredDay.count} contribution${hoveredDay.count !== 1 ? 's' : ''}`
                      : 'No activity'}
                  </p>
                  {hoveredDay.count > 0 && (
                    <div className="text-surface-container-highest/80 mt-0.5 space-x-2">
                      {hoveredDay.types.solo > 0 && <span>Solo: {hoveredDay.types.solo}</span>}
                      {hoveredDay.types.room > 0 && <span>Room: {hoveredDay.types.room}</span>}
                      {hoveredDay.types.quests > 0 && <span>Quests: {hoveredDay.types.quests}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <StatCard
                icon="stacked_line_chart"
                label="Total Contributions"
                value={data.stats.totalContributions.toLocaleString()}
                accent="text-primary"
              />
              <StatCard
                icon="local_fire_department"
                label="Current Streak"
                value={`${data.stats.currentStreak} day${data.stats.currentStreak !== 1 ? 's' : ''}`}
                accent="text-orange-500"
                subtitle={data.stats.currentStreak >= 7 ? 'Keep it up!' : undefined}
              />
              <StatCard
                icon="military_tech"
                label="Longest Streak"
                value={`${data.stats.longestStreak} day${data.stats.longestStreak !== 1 ? 's' : ''}`}
                accent="text-tertiary"
              />
              <StatCard
                icon="calendar_today"
                label="Active Days"
                value={data.stats.activeDays.toLocaleString()}
                accent="text-blue-600"
                subtitle="Last 365 days"
              />
            </div>

            {/* Breakdown */}
            {(data.breakdown.solo > 0 || data.breakdown.room > 0 || data.breakdown.quests > 0) && (
              <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-6 mt-6 shadow-[0_20px_50px_rgba(63,72,73,0.04)]">
                <h3 className="text-on-background font-semibold mb-4">Activity Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  <BreakdownItem label="Solo Tasks" value={data.breakdown.solo} color="bg-orange-500" total={data.stats.totalContributions} />
                  <BreakdownItem label="Room Battles" value={data.breakdown.room} color="bg-cyan-500" total={data.stats.totalContributions} />
                  <BreakdownItem label="Quests" value={data.breakdown.quests} color="bg-purple-500" total={data.stats.totalContributions} />
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {data && !loading && data.stats.totalContributions === 0 && (
          <div className="text-center py-12 mt-6">
            <p className="text-on-surface-variant/60 text-lg">No activity yet. Complete your first task to start filling your heatmap!</p>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, accent, subtitle }: {
  icon: string;
  label: string;
  value: string;
  accent: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(63,72,73,0.04)]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined text-lg ${accent}`}>{icon}</span>
        <span className="text-on-surface-variant/60 text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-on-background">{value}</p>
      {subtitle && <p className="text-on-surface-variant/40 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function BreakdownItem({ label, value, color, total }: {
  label: string;
  value: number;
  color: string;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-on-surface-variant/60">{label}</span>
        <span className="text-on-background font-medium">{value}</span>
      </div>
      <div className="w-full h-2 bg-surface-container-highest/40 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
