import Link from "next/link";

export default function Room() {
  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-[#fafaf5]/70 dark:bg-[#1a1c19]/70 backdrop-blur-xl shadow-[0_20px_50px_rgba(63,72,73,0.06)]">
        <div className="flex justify-between items-center px-8 h-16 w-full max-w-[1440px] mx-auto relative">
          <div className="flex items-center gap-8">
            <span className="text-xl font-black text-[#25686a] dark:text-[#5f9ea0] tracking-tight">DevPath</span>
            <div className="hidden md:flex items-center gap-6">
              <Link className="text-[#3f4849] dark:text-[#e3e3de] hover:text-[#25686a] transition-all duration-300 font-headline font-bold tracking-tight" href="/dashboard">Dashboard</Link>
              <Link className="text-[#25686a] dark:text-[#92d2d3] border-b-2 border-[#25686a] pb-1 font-headline font-bold tracking-tight" href="/room">Rooms</Link>
              <Link className="text-[#3f4849] dark:text-[#e3e3de] hover:text-[#25686a] transition-all duration-300 font-headline font-bold tracking-tight" href="/room/heatmap">Heatmap</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-container-low px-4 py-1.5 rounded-full">
              <span className="text-xs font-bold text-tertiary">Streak: 12 🔥</span>
              <div className="w-px h-3 bg-outline-variant/30"></div>
              <span className="text-xs font-bold text-primary">2,450 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-[#f4f4ef]/50 rounded-full transition-all active:scale-95">
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </button>
              <button className="p-2 hover:bg-[#f4f4ef]/50 rounded-full transition-all active:scale-95">
                <span className="material-symbols-outlined text-on-surface-variant">bolt</span>
              </button>
            </div>
            <img alt="User profile avatar" className="w-8 h-8 rounded-full border border-outline-variant/20" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP"/>
          </div>
          <div className="bg-[#f4f4ef] dark:bg-[#2c2e2a] h-[1px] w-full absolute bottom-0 opacity-20 left-0"></div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-8 max-w-[1440px] mx-auto min-h-screen flex flex-col gap-8">
        <header className="flex flex-col items-center text-center gap-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary-container rounded-full animate-pulse">
            <span className="material-symbols-outlined text-sm text-on-secondary-container" style={{fontVariationSettings: "'FILL' 1"}}>timer</span>
            <span className="text-xs font-bold text-on-secondary-container tracking-wider uppercase font-label">Speed Duel</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-background max-w-2xl">
            The Architect&apos;s Crucible
          </h1>
          <p className="text-on-surface-variant max-w-lg leading-relaxed font-body">
            Competing in <span className="text-primary font-semibold">Intermediate Rust Systems</span>. The lobby closes when 10 participants are ready.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col gap-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary-container/10 rounded-xl blur-2xl opacity-50"></div>
              <div className="relative glass-panel rounded-xl border border-primary/20 p-12 flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(63,72,73,0.06)] overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-container/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
                
                <span className="text-xs font-bold text-primary tracking-[0.2em] uppercase mb-4 opacity-70">Live Access Code</span>
                <div className="flex items-center gap-4">
                  <span className="text-6xl md:text-8xl font-mono font-medium tracking-widest text-primary drop-shadow-sm">XF7R92</span>
                  <button className="p-3 hover:bg-surface-container-high rounded-full transition-colors group/copy active:scale-90">
                    <span className="material-symbols-outlined text-primary/60 group-hover/copy:text-primary">content_copy</span>
                  </button>
                </div>
                
                <div className="mt-8 flex gap-6 items-center">
                  <div className="flex -space-x-3">
                    <img className="w-10 h-10 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP"/>
                    <img className="w-10 h-10 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP"/>
                    <div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-xs font-bold text-primary">+4</div>
                  </div>
                  <span className="text-sm text-on-surface-variant font-medium">8 / 12 slots filled</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Member Card 1 */}
              <div className="bg-surface-container-lowest rounded-lg p-4 flex flex-col items-center gap-3 transition-transform hover:-translate-y-1 shadow-sm">
                <div className="relative">
                  <img className="w-16 h-16 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP"/>
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#4ade80] border-2 border-surface-container-lowest rounded-full"></div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-on-surface">Sarah_Dev</p>
                  <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Ready</p>
                </div>
              </div>
              
              {/* Member Card 2 */}
              <div className="bg-surface-container-lowest rounded-lg p-4 border border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                <span className="material-symbols-outlined text-primary text-3xl">add_circle</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Invite Friend</p>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-xl font-bold text-on-background tracking-tight">Leaderboard</h2>
                  <p className="text-xs text-on-surface-variant">Live Progress Ranking</p>
                </div>
                <span className="material-symbols-outlined text-primary-fixed-dim">analytics</span>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-tertiary-container rounded-full text-[10px] font-bold text-on-tertiary-container">1</span>
                      <span className="text-sm font-semibold text-on-surface">Alex Chen</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-primary">82%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{width: "82%"}}></div>
                  </div>
                </div>
              </div>
              
              <button className="w-full mt-10 bg-primary text-on-primary py-4 rounded-full font-bold text-sm tracking-wide transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
                I&apos;m Ready
                <span className="material-symbols-outlined text-sm">rocket_launch</span>
              </button>
            </div>
          </aside>
        </div>

        <footer className="mt-auto">
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-surface-container-high">
            <div className="px-6 py-3 bg-surface-container-low border-b border-surface-container-high flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-error rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Live Feed</span>
              </div>
              <span className="text-[10px] font-medium text-on-surface-variant opacity-60">Connected to Lobby Node-04</span>
            </div>
            <div className="h-16 overflow-hidden relative flex items-center">
              <div className="flex gap-12 px-8 whitespace-nowrap animate-marquee">
                <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                  <span className="text-primary font-bold">@Sarah_Dev</span> solved Task 1 in 45s
                </div>
                <div className="w-1 h-1 bg-outline-variant rounded-full"></div>
                <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                  <span className="text-primary font-bold">@Elena S.</span> joined the room
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
