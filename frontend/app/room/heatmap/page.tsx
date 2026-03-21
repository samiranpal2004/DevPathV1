import Link from "next/link";

export default function Heatmap() {
  const colors = ['bg-[#FFFDD0]', 'bg-[#FFFDD0]', 'bg-[#FFFDD0]', 'bg-[#B2AC88]', 'bg-[#5f9ea0]', 'bg-[#25686a]'];
  const special: Record<number, string> = {
    24: 'bg-[#f97316] ring-2 ring-[#f97316]/20',
    45: 'bg-[#cba72f] ring-2 ring-[#cba72f]/20',
    88: 'bg-[#3b82f6] ring-2 ring-[#3b82f6]/20',
    120: 'bg-[#25686a]',
    200: 'bg-[#cba72f]'
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[#fafaf5]/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(63,72,73,0.06)]">
        <div className="flex justify-between items-center px-8 h-16 w-full max-w-[1440px] mx-auto relative">
          <div className="flex items-center gap-8">
            <span className="text-xl font-black text-[#25686a] font-headline">DevPath</span>
            <nav className="hidden md:flex items-center gap-6">
              <Link className="font-headline font-bold tracking-tight text-[#3f4849] hover:text-[#25686a] transition-all duration-300" href="/dashboard">Dashboard</Link>
              <Link className="font-headline font-bold tracking-tight text-[#3f4849] hover:text-[#25686a] transition-all duration-300" href="/room">Rooms</Link>
              <Link className="font-headline font-bold tracking-tight text-[#25686a] border-b-2 border-[#25686a] pb-1" href="/room/heatmap">Heatmap</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full">
              <span className="text-sm font-bold text-primary">Streak: 12 🔥</span>
              <span className="w-[1px] h-3 bg-outline/20"></span>
              <span className="text-xs font-semibold text-on-surface-variant">2,450 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-full hover:bg-surface-container-low transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </button>
              <button className="p-2 rounded-full hover:bg-surface-container-low transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">bolt</span>
              </button>
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                <img alt="User profile avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP"/>
              </div>
            </div>
          </div>
          <div className="bg-[#f4f4ef] h-[1px] w-full absolute bottom-0 opacity-20"></div>
        </div>
      </header>
      
      <aside className="hidden lg:flex flex-col py-6 px-4 fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-[#f4f4ef] font-headline text-sm font-semibold">
        <div className="flex items-center gap-3 px-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>terminal</span>
          </div>
          <div>
            <p className="text-lg font-bold text-[#25686a] leading-none">DevPath</p>
            <p className="text-xs text-on-surface-variant font-normal">Daily Coach</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <Link className="flex items-center gap-3 px-4 py-3 text-[#3f4849] hover:bg-[#e3e3de] rounded-full transition-transform hover:translate-x-1" href="/dashboard">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 text-[#3f4849] hover:bg-[#e3e3de] rounded-full transition-transform hover:translate-x-1" href="/room">
            <span className="material-symbols-outlined">groups</span>
            <span>Rooms</span>
          </Link>
          <Link className="flex items-center gap-3 px-4 py-3 bg-white text-[#25686a] rounded-full shadow-sm transition-transform hover:translate-x-1" href="/heatmap">
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>calendar_view_month</span>
            <span>Heatmap</span>
          </Link>
        </nav>
        <div className="px-4 mb-8">
          <button className="w-full py-3 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
            Start Lesson
          </button>
        </div>
        <div className="pt-6 border-t border-outline/10 space-y-1">
          <a className="flex items-center gap-3 px-4 py-3 text-[#3f4849] hover:bg-[#e3e3de] rounded-full transition-transform hover:translate-x-1" href="#">
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-[#3f4849] hover:bg-[#e3e3de] rounded-full transition-transform hover:translate-x-1" href="#">
            <span className="material-symbols-outlined">help_outline</span>
            <span>Support</span>
          </a>
        </div>
      </aside>
      
      <main className="pt-24 pb-20 px-6 lg:ml-64 max-w-[1440px] mx-auto min-h-screen">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-4xl font-black font-headline tracking-tighter text-on-background">Activity Heatmap</h1>
                <p className="text-on-surface-variant font-body mt-1">Your coding consistency and milestone achievements.</p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-full border border-secondary text-secondary font-semibold text-sm hover:bg-secondary-container/30 transition-colors">All Activity</button>
                <button className="px-4 py-2 rounded-full border border-outline/20 text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition-colors">Solo</button>
                <button className="px-4 py-2 rounded-full border border-outline/20 text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition-colors">Room Battles</button>
                <button className="px-4 py-2 rounded-full border border-outline/20 text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition-colors">Quests</button>
              </div>
            </div>
            
            <div className="bg-surface-container-lowest p-8 rounded-lg shadow-[0_20px_50px_rgba(63,72,73,0.06)] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-tertiary shadow-[0_0_10px_#735c00]"></div>
              <div className="flex gap-4">
                <div className="flex flex-col justify-between text-[10px] text-on-surface-variant/60 font-medium py-2 uppercase tracking-widest">
                  <span>Mon</span><span>Wed</span><span>Fri</span>
                </div>
                <div className="flex-1 overflow-x-auto custom-scrollbar">
                  <div className="grid grid-cols-[repeat(53,minmax(0,1fr))] gap-1 min-w-[800px]">
                    {Array.from({length: 53 * 7}).map((_, i) => {
                      const colorClass = special[i] || colors[i % colors.length]; // Fake progression for demo
                      return <div key={i} className={`aspect-square rounded-sm ${colorClass}`} title={`Day ${i}`}></div>;
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-on-surface-variant/60 font-medium mt-4 uppercase tracking-widest px-1">
                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-8 text-xs text-on-surface-variant/70 font-medium">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-[#FFFDD0]"></div>
                  <div className="w-3 h-3 rounded-sm bg-[#B2AC88]"></div>
                  <div className="w-3 h-3 rounded-sm bg-[#5f9ea0]"></div>
                  <div className="w-3 h-3 rounded-sm bg-[#25686a]"></div>
                </div>
                <span>More</span>
                <div className="w-[1px] h-3 bg-outline/20 mx-2"></div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#f97316]"></div><span>Room Win</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#cba72f]"></div><span>Milestone</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div><span>Level Up</span></div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface-container-low p-6 rounded-lg flex flex-col justify-between">
                <span className="text-on-surface-variant text-sm font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">stacked_line_chart</span> Total Contributions
                </span>
                <div className="mt-4">
                  <span className="text-4xl font-black font-headline text-on-background">1,842</span>
                  <span className="text-primary text-xs font-bold ml-2">+12% vs last year</span>
                </div>
              </div>
              <div className="bg-surface-container-low p-6 rounded-lg flex flex-col justify-between border-t-2 border-tertiary">
                <span className="text-on-surface-variant text-sm font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-lg" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span> Current Streak
                </span>
                <div className="mt-4">
                  <span className="text-4xl font-black font-headline text-on-background">12 Days</span>
                  <p className="text-on-surface-variant/60 text-xs mt-1">Keep it up, you&apos;re on fire!</p>
                </div>
              </div>
              <div className="bg-surface-container-low p-6 rounded-lg flex flex-col justify-between">
                <span className="text-on-surface-variant text-sm font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container text-lg">military_tech</span> Longest Streak
                </span>
                <div className="mt-4">
                  <span className="text-4xl font-black font-headline text-on-background">48 Days</span>
                  <p className="text-on-surface-variant/60 text-xs mt-1">Achieved in March 2024</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-surface-container-lowest p-8 rounded-lg shadow-[0_20px_50px_rgba(63,72,73,0.06)] flex flex-col items-center text-center sticky top-24 border border-outline/5">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary to-secondary-container">
                  <div className="w-full h-full rounded-full bg-white p-1 overflow-hidden">
                    <img alt="User Avatar" className="w-full h-full object-cover rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP"/>
                  </div>
                </div>
                <div className="absolute -bottom-2 right-2 bg-tertiary text-on-tertiary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-md">
                   Lvl 24
                </div>
              </div>
              <h2 className="text-2xl font-black font-headline text-on-background">Alex Rivers</h2>
              <p className="text-on-surface-variant font-body mb-4">@arivers_dev</p>
              <div className="flex gap-2 mb-8">
                <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-widest">Builder</span>
                <span className="px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-[10px] font-bold uppercase tracking-widest">TypeScript</span>
              </div>
              <div className="w-full space-y-2 mb-8">
                <div className="flex justify-between text-xs font-bold text-on-surface-variant px-1">
                  <span>Experience</span>
                  <span>2,450 / 3,000 XP</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(37,104,106,0.3)]" style={{width: "82%"}}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant/50 tracking-widest">Rank</p>
                  <p className="text-lg font-black text-on-background">#142</p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant/50 tracking-widest">Rooms Won</p>
                  <p className="text-lg font-black text-on-background">14</p>
                </div>
              </div>
              <button className="w-full py-4 bg-primary text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-colors shadow-lg shadow-primary/10 group">
                <span className="material-symbols-outlined text-xl">share</span>
                Share Profile Card
              </button>
            </div>
            
            <div className="bg-tertiary-container/20 p-4 rounded-lg flex items-center gap-4 border-l-4 border-tertiary">
              <div className="w-12 h-12 bg-tertiary rounded-full flex items-center justify-center text-on-tertiary">
                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>emoji_events</span>
              </div>
              <div>
                <p className="text-xs font-bold text-on-tertiary-container/60 uppercase tracking-widest">Latest Milestone</p>
                <p className="font-bold text-on-tertiary-container">Iron Consistency II</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="bg-[#fafaf5] w-full py-12 mt-12 border-t border-[#3f4849]/10">
        <div className="max-w-[1440px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-8">
            <span className="text-[#3f4849]/60 font-body text-xs font-medium">© 2024 DevPath. Systems Nominal.</span>
          </div>
          <div className="flex items-center gap-6">
            <a className="font-body text-xs text-[#3f4849]/60 hover:text-[#25686a] transition-colors" href="#">Terms</a>
            <a className="font-body text-xs text-[#3f4849]/60 hover:text-[#25686a] transition-colors" href="#">Privacy</a>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100/50 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-body text-[10px] font-bold text-green-700 uppercase tracking-widest">Status: Online</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
