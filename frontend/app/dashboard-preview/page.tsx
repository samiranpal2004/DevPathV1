import Link from "next/link";
import React from 'react';

export default function DashboardPreview() {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-[#fafaf5]/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(63,72,73,0.06)]">
        <div className="flex justify-between items-center px-8 h-16 w-full max-w-[1440px] mx-auto relative">
          <div className="flex items-center gap-8">
            <span className="text-xl font-black text-primary font-headline tracking-tight">DevPath</span>
            <div className="hidden md:flex gap-6 items-center">
              <Link className="font-headline font-bold tracking-tight text-primary border-b-2 border-primary pb-1" href="/dashboard">Dashboard</Link>
              <Link className="font-headline font-bold tracking-tight text-on-surface-variant hover:text-primary transition-all duration-300" href="/room">Rooms</Link>
              <Link className="font-headline font-bold tracking-tight text-on-surface-variant hover:text-primary transition-all duration-300" href="/heatmap">Heatmap</Link>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-tertiary-fixed/30 rounded-full">
              <span className="material-symbols-outlined text-tertiary" style={{fontVariationSettings: "'FILL' 1"}}>bolt</span>
              <span className="font-headline font-bold text-sm text-on-tertiary-fixed-variant">Streak: 12 🔥</span>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-primary">2,450 XP</span>
              <div className="w-24 h-1.5 bg-surface-container rounded-full mt-1 overflow-hidden">
                <div className="w-3/4 h-full bg-primary-container"></div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="p-2 rounded-full hover:bg-surface-container-low transition-all active:scale-95">
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </button>
              <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant/20">
                <img alt="User profile avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP" />
              </div>
            </div>
          </div>
          <div className="bg-surface-container h-[1px] w-full absolute bottom-0 opacity-20"></div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-8 max-w-[1200px] mx-auto xl:ml-28">
        {/* Greeting Section */}
        <header className="mb-12 relative">
          <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary-container/5 blur-[100px] rounded-full pointer-events-none"></div>
          <h1 className="text-5xl font-extrabold text-on-background tracking-tight mb-2">Good morning, Alex.</h1>
          <p className="text-lg text-on-surface-variant max-w-xl">Your focus path is ready. Complete today's mission to maintain your 12-day momentum.</p>
        </header>

        {/* Main Mission Canvas */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Daily Mission Card */}
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-lg p-10 shadow-[0_20px_50px_rgba(63,72,73,0.04)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tertiary to-tertiary-container opacity-50"></div>
            <div className="flex justify-between items-end mb-10">
              <div>
                <span className="text-xs font-bold tracking-widest text-tertiary uppercase mb-2 block">Active Mission</span>
                <h2 className="text-3xl font-bold text-on-background tracking-tight">Advanced React Patterns</h2>
              </div>
              <span className="text-sm font-medium text-on-surface-variant bg-surface-container-low px-4 py-2 rounded-full">Estimated: 45 min</span>
            </div>
            <div className="space-y-6">
              {/* Task 1 */}
              <div className="flex items-center p-6 bg-surface-container-low/40 hover:bg-surface-container-low transition-all duration-300 rounded-lg group/item cursor-pointer">
                <div className="w-8 h-8 rounded-full border-2 border-primary-container/30 flex items-center justify-center mr-6 group-hover/item:border-primary transition-colors">
                  <span className="material-symbols-outlined text-primary scale-0 group-hover/item:scale-100 transition-transform">check</span>
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-on-background">Implement Higher Order Components</h3>
                  <p className="text-sm text-on-surface-variant">Review the documentation and create a basic auth wrapper.</p>
                </div>
                <span className="text-xs font-bold text-primary-container bg-primary-fixed px-3 py-1 rounded-full">15 min</span>
              </div>
              {/* Task 2 */}
              <div className="flex items-center p-6 bg-surface-container-low/40 hover:bg-surface-container-low transition-all duration-300 rounded-lg group/item cursor-pointer">
                <div className="w-8 h-8 rounded-full border-2 border-primary-container/30 flex items-center justify-center mr-6 group-hover/item:border-primary transition-colors">
                  <span className="material-symbols-outlined text-primary scale-0 group-hover/item:scale-100 transition-transform">check</span>
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-on-background">Custom Hook Refactoring</h3>
                  <p className="text-sm text-on-surface-variant">Convert the useFetch logic to handle retry states.</p>
                </div>
                <span className="text-xs font-bold text-primary-container bg-primary-fixed px-3 py-1 rounded-full">20 min</span>
              </div>
              {/* Practice Problem */}
              <div className="flex items-center p-6 bg-secondary-container/20 hover:bg-secondary-container/30 transition-all duration-300 rounded-lg group/item cursor-pointer relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary"></div>
                <div className="w-8 h-8 rounded-full border-2 border-tertiary/30 flex items-center justify-center mr-6 group-hover/item:border-tertiary transition-colors">
                  <span className="material-symbols-outlined text-tertiary scale-0 group-hover/item:scale-100 transition-transform">check</span>
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-on-background">Practice: Memoization Challenge</h3>
                  <p className="text-sm text-on-surface-variant">Solve the compute-heavy list rendering bottleneck.</p>
                </div>
                <span className="text-xs font-bold text-tertiary bg-tertiary-fixed px-3 py-1 rounded-full">10 min</span>
              </div>
            </div>
            <div className="mt-12 flex justify-center">
              <button className="px-12 py-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-lg shadow-lg hover:shadow-primary/20 active:scale-95 transition-all">
                                  Complete Session
                              </button>
            </div>
          </div>

          {/* Side Actions & Stats */}
          <div className="lg:col-span-4 space-y-8">
            {/* Mode Buttons */}
            <div className="bg-surface-container-low rounded-lg p-8 space-y-4">
              <h3 className="text-sm font-bold text-on-surface-variant tracking-widest uppercase mb-4">Daily Rhythm</h3>
              <button className="w-full py-3 px-6 rounded-full border border-primary/20 bg-surface-container-lowest text-primary font-bold hover:bg-primary hover:text-white transition-all text-sm flex items-center justify-between group">
                  Normal Day
                  <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">check_circle</span>
              </button>
              <button className="w-full py-3 px-6 rounded-full border border-outline-variant/30 text-on-surface-variant font-bold hover:border-primary/40 transition-all text-sm flex items-center justify-between">
                  Busy Day
                  <span className="text-[10px] text-tertiary bg-tertiary-fixed px-2 py-0.5 rounded-full">Quick Mode</span>
              </button>
              <button className="w-full py-3 px-6 rounded-full border border-outline-variant/30 text-on-surface-variant font-bold hover:border-error/40 transition-all text-sm flex items-center justify-between">
                  Skip Day
                  <span className="material-symbols-outlined text-sm">event_busy</span>
              </button>
            </div>

            {/* Subtle Mini Stats Card */}
            <div className="bg-primary/5 rounded-lg p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-primary/60 uppercase">Completion Rate</p>
                  <p className="text-2xl font-black text-primary">84%</p>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant">You're in the top 5% of React learners this week. Keep the pace.</p>
            </div>
          </div>
        </section>

        {/* Weekly Momentum & Insights Section */}
        <section className="mt-20">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">speed</span>
              <h3 className="text-xs font-bold text-on-surface-variant tracking-[0.2em] uppercase">Weekly Momentum &amp; Insights</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="text-[10px] font-bold text-on-surface-variant/60">Focus Time</span>
              <span className="w-2 h-2 rounded-full bg-tertiary ml-2"></span>
              <span className="text-[10px] font-bold text-on-surface-variant/60">Milestone</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Chart Visualization */}
            <div className="lg:col-span-8 bg-surface-container-low/30 rounded-lg p-8 border border-outline-variant/5">
              <div className="flex items-end justify-between h-48 gap-4 px-4 relative">
                {/* Chart Y-Axis Markers (Subtle) */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2">
                  <div className="border-t border-outline-variant/10 w-full"></div>
                  <div className="border-t border-outline-variant/10 w-full"></div>
                  <div className="border-t border-outline-variant/10 w-full"></div>
                </div>

                {/* Day Bars */}
                <div className="flex flex-col items-center gap-3 w-full group/bar">
                  <div className="relative w-full flex flex-col justify-end h-full">
                    <div className="w-full bg-primary/30 hover:bg-primary/50 transition-all duration-500 rounded-full h-[40%] cursor-help"></div>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant/40">MON</span>
                </div>
                <div className="flex flex-col items-center gap-3 w-full group/bar">
                  <div className="relative w-full flex flex-col justify-end h-full">
                    <div className="w-full bg-primary/40 hover:bg-primary/60 transition-all duration-500 rounded-full h-[65%] cursor-help"></div>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant/40">TUE</span>
                </div>
                <div className="flex flex-col items-center gap-3 w-full group/bar">
                  <div className="relative w-full flex flex-col justify-end h-full">
                    {/* Milestone Marker */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      <span className="text-[10px] font-bold text-tertiary bg-tertiary-fixed px-2 py-0.5 rounded shadow-sm whitespace-nowrap">Peak Focus</span>
                      <div className="w-1 h-2 bg-tertiary/40"></div>
                    </div>
                    <div className="w-full bg-primary/80 hover:bg-primary transition-all duration-500 rounded-full h-[95%] cursor-help">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-primary">WED</span>
                </div>
                <div className="flex flex-col items-center gap-3 w-full group/bar">
                  <div className="relative w-full flex flex-col justify-end h-full">
                    <div className="w-full bg-primary/50 hover:bg-primary/70 transition-all duration-500 rounded-full h-[55%] cursor-help"></div>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant/40">THU</span>
                </div>
                <div className="flex flex-col items-center gap-3 w-full group/bar">
                  <div className="relative w-full flex flex-col justify-end h-full">
                    <div className="w-full bg-tertiary/60 hover:bg-tertiary/80 transition-all duration-500 rounded-full h-[80%] cursor-help flex justify-center pt-1.5">
                      <span className="material-symbols-outlined text-[12px] text-white">military_tech</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant/40">FRI</span>
                </div>
                <div className="flex flex-col items-center gap-3 w-full group/bar">
                  <div className="relative w-full flex flex-col justify-end h-full">
                    <div className="w-full bg-primary/20 hover:bg-primary/40 transition-all duration-500 rounded-full h-[30%] cursor-help"></div>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant/40">SAT</span>
                </div>
                <div className="flex flex-col items-center gap-3 w-full group/bar">
                  <div className="relative w-full flex flex-col justify-end h-full">
                    <div className="w-full bg-primary/10 hover:bg-primary/30 transition-all duration-500 rounded-full h-[15%] cursor-help"></div>
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant/40">SUN</span>
                </div>
              </div>
            </div>

            {/* Momentum Insight Card */}
            <div className="lg:col-span-4 bg-primary text-on-primary rounded-lg p-8 relative overflow-hidden shadow-xl shadow-primary/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-secondary-fixed">auto_awesome</span>
                  <span className="text-xs font-bold tracking-widest uppercase opacity-80">AI Momentum Insight</span>
                </div>
                <p className="text-xl font-headline font-bold mb-6 leading-tight">You're 15% more active this week than last. Keep the 12-day flame alive.</p>
                <div className="mt-auto pt-6 border-t border-white/10">
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-70 font-medium">Estimated 7-day XP</span>
                    <span className="font-bold text-secondary-fixed">+1,840 XP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Leaderboard Preview Section */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12 bg-surface-container-low/30 rounded-lg p-8 border border-outline-variant/5">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">workspace_premium</span>
                <h3 className="text-xs font-bold text-on-surface-variant tracking-[0.2em] uppercase">Top Performers</h3>
              </div>
              <Link className="text-[10px] font-extrabold text-primary tracking-[0.15em] uppercase hover:underline decoration-primary/30 underline-offset-4 transition-all" href="/room">View Full Leaderboard</Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Top Performer 1 */}
              <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 hover:shadow-lg hover:shadow-primary/5 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-tertiary/20">
                      <img alt="Performer 1" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AG82GZ_9X79A63t_U_o_oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1"/>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-tertiary text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">1</div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-headline font-bold text-sm text-on-background truncate">Sarah Jenkins</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] font-medium text-on-surface-variant">4,920 XP</p>
                      <p className="text-[10px] font-bold text-primary">Rank: 0.1%</p>
                    </div>
                    <div className="w-full h-1 bg-surface-container rounded-full mt-2 overflow-hidden">
                      <div className="w-full h-full bg-tertiary"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performer 2 */}
              <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-outline-variant/20">
                      <img alt="Performer 2" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AG82GZ_9X79A63t_U_o_oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1"/>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-outline-variant text-on-surface-variant text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">2</div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-headline font-bold text-sm text-on-background truncate">Marcus Chen</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] font-medium text-on-surface-variant">4,750 XP</p>
                    </div>
                    <div className="w-full h-1 bg-surface-container rounded-full mt-2 overflow-hidden">
                      <div className="w-[92%] h-full bg-primary-container"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performer 3 */}
              <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-outline-variant/20">
                      <img alt="Performer 3" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AG82GZ_9X79A63t_U_o_oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1"/>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-outline-variant/50 text-on-surface-variant text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">3</div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-headline font-bold text-sm text-on-background truncate">Elena Rossi</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] font-medium text-on-surface-variant">4,200 XP</p>
                    </div>
                    <div className="w-full h-1 bg-surface-container rounded-full mt-2 overflow-hidden">
                      <div className="w-[85%] h-full bg-primary-container/70"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performer 4 */}
              <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-outline-variant/20">
                      <img alt="Performer 4" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AG82GZ_9X79A63t_U_o_oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1G7oX6Z1"/>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-outline-variant/30 text-on-surface-variant text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">4</div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-headline font-bold text-sm text-on-background truncate">David Park</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] font-medium text-on-surface-variant">3,890 XP</p>
                    </div>
                    <div className="w-full h-1 bg-surface-container rounded-full mt-2 overflow-hidden">
                      <div className="w-[78%] h-full bg-primary-container/50"></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-outline-variant/10 pt-6 flex justify-between items-center text-[11px] font-medium text-on-surface-variant/50">
          <span>© 2024 DevPath. Systems Nominal.</span>
          <div className="flex gap-6">
            <a className="hover:text-primary transition-colors" href="#">Terms</a>
            <a className="hover:text-primary transition-colors" href="#">Privacy</a>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Status: Online</span>
          </div>
        </footer>
      </main>

      {/* Side Navigation Sidebar */}
      <aside className="hidden xl:flex flex-col py-8 px-6 fixed left-0 top-0 h-full w-20 bg-surface-container-low/30 items-center gap-8 border-r border-outline-variant/5">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-white">terminal</span>
        </div>
        <nav className="flex flex-col gap-6">
          <Link className="p-3 rounded-full bg-white text-primary shadow-sm" href="/dashboard">
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>dashboard</span>
          </Link>
          <Link className="p-3 rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all" href="/room">
            <span className="material-symbols-outlined">groups</span>
          </Link>
          <Link className="p-3 rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all" href="/heatmap">
            <span className="material-symbols-outlined">calendar_view_month</span>
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <a className="p-3 rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all" href="#">
            <span className="material-symbols-outlined">settings</span>
          </a>
          <a className="p-3 rounded-full text-on-surface-variant hover:bg-surface-container-highest transition-all" href="#">
            <span className="material-symbols-outlined">help_outline</span>
          </a>
        </div>
      </aside>

    </div>
  );
}
