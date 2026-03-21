export default function Onboarding() {
  return (
    <main className="min-h-screen flex flex-col items-center pt-12 pb-24 px-6 max-w-4xl mx-auto">
      {/* Global Progress Indicator */}
      <div className="w-full max-w-md mb-16">
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-label text-xs font-semibold tracking-widest text-[#25686a] uppercase">Onboarding</span>
          <span className="text-label text-xs font-medium text-[#3f4849]">Step 3 of 5</span>
        </div>
        <div className="h-1.5 w-full bg-[#eeeee9] rounded-full overflow-hidden">
          <div className="h-full bg-[#25686a] w-3/5 rounded-full transition-all duration-500"></div>
        </div>
      </div>
      
      {/* Onboarding Header */}
      <div className="text-center mb-16">
        <h1 className="headline-text text-4xl md:text-5xl font-extrabold text-[#1a1c19] mb-4">Let's build your path.</h1>
        <p className="text-[#3f4849] text-lg max-w-lg mx-auto leading-relaxed">Customize your DevPath experience to match your career goals and schedule.</p>
      </div>
      
      {/* Steps Container */}
      <div className="w-full space-y-32">
        {/* Step 1: Goal Selection */}
        <section className="w-full" id="step-1">
          <h2 className="headline-text text-2xl font-bold mb-8 text-center">What is your primary goal?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* Job Prep */}
            <button className="group relative flex items-center p-6 bg-[#ffffff] rounded-full transition-all duration-300 hover:shadow-[0_20px_50px_rgba(63,72,73,0.06)] hover:translate-y-[-2px] border border-transparent hover:border-[#92d2d3]">
              <div className="w-12 h-12 flex items-center justify-center bg-[#eeeee9] rounded-full mr-6 text-[#25686a] group-hover:bg-[#25686a] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>work</span>
              </div>
              <span className="text-lg font-semibold text-[#1a1c19]">Job Prep</span>
            </button>
            {/* Complete My Course */}
            <button className="group relative flex items-center p-6 bg-[#ffffff] rounded-full transition-all duration-300 hover:shadow-[0_20px_50px_rgba(63,72,73,0.06)] hover:translate-y-[-2px] border border-transparent hover:border-[#92d2d3]">
              <div className="w-12 h-12 flex items-center justify-center bg-[#eeeee9] rounded-full mr-6 text-[#25686a] group-hover:bg-[#25686a] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">menu_book</span>
              </div>
              <span className="text-lg font-semibold text-[#1a1c19]">Complete My Course</span>
            </button>
            {/* Learn DSA */}
            <button className="group relative flex items-center p-6 bg-[#ffffff] rounded-full transition-all duration-300 hover:shadow-[0_20px_50px_rgba(63,72,73,0.06)] hover:translate-y-[-2px] border border-transparent hover:border-[#92d2d3]">
              <div className="w-12 h-12 flex items-center justify-center bg-[#eeeee9] rounded-full mr-6 text-[#25686a] group-hover:bg-[#25686a] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">code_blocks</span>
              </div>
              <span className="text-lg font-semibold text-[#1a1c19]">Learn DSA</span>
            </button>
            {/* General Beginner */}
            <button className="group relative flex items-center p-6 bg-[#ffffff] rounded-full transition-all duration-300 hover:shadow-[0_20px_50px_rgba(63,72,73,0.06)] hover:translate-y-[-2px] border border-transparent hover:border-[#92d2d3]">
              <div className="w-12 h-12 flex items-center justify-center bg-[#eeeee9] rounded-full mr-6 text-[#25686a] group-hover:bg-[#25686a] group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">eco</span>
              </div>
              <span className="text-lg font-semibold text-[#1a1c19]">General Beginner</span>
            </button>
          </div>
        </section>
        
        {/* Step 2: Time Budget */}
        <section className="w-full" id="step-2">
          <h2 className="headline-text text-2xl font-bold mb-8 text-center">Daily Time Budget</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="px-8 py-3 bg-[#ffffff] text-[#3f4849] font-medium rounded-full border border-gray-200 hover:bg-[#e8e0ba] hover:text-[#686344] transition-all">15 mins</button>
            <button className="px-8 py-3 bg-[#25686a] text-white font-bold rounded-full shadow-lg shadow-[#25686a]/20 scale-105">20 mins</button>
            <button className="px-8 py-3 bg-[#ffffff] text-[#3f4849] font-medium rounded-full border border-gray-200 hover:bg-[#e8e0ba] hover:text-[#686344] transition-all">30 mins</button>
            <button className="px-8 py-3 bg-[#ffffff] text-[#3f4849] font-medium rounded-full border border-gray-200 hover:bg-[#e8e0ba] hover:text-[#686344] transition-all">Flexible</button>
          </div>
        </section>
        
        {/* Step 3: Skill Quiz */}
        <section className="w-full max-w-2xl mx-auto" id="step-3">
          <div className="bg-[#f4f4ef] p-10 rounded-lg">
            <h2 className="headline-text text-2xl font-bold mb-2">Technical Assessment</h2>
            <p className="text-[#3f4849] mb-8">Question 3 of 5</p>
            <div className="space-y-4 mb-10">
              <p className="text-lg font-medium text-[#1a1c19] mb-6">Which of the following is the most efficient way to handle state in a large-scale React application?</p>
              <label className="flex items-center p-5 bg-[#ffffff] rounded-xl border border-transparent cursor-pointer hover:bg-[#fafaf5] transition-all">
                <input className="w-5 h-5 text-[#25686a] border-[#bfc8c8] focus:ring-[#92d2d3] bg-[#fafaf5]" name="quiz" type="radio"/>
                <span className="ml-4 text-[#1a1c19]">Prop drilling through 5+ layers</span>
              </label>
              <label className="flex items-center p-5 bg-[#ffffff] rounded-xl border border-[#25686a]/20 cursor-pointer bg-[#25686a]/5 transition-all">
                <input defaultChecked className="w-5 h-5 text-[#25686a] border-[#bfc8c8] focus:ring-[#92d2d3] bg-[#fafaf5]" name="quiz" type="radio"/>
                <span className="ml-4 text-[#1a1c19] font-semibold">Context API or specialized state managers</span>
              </label>
              <label className="flex items-center p-5 bg-[#ffffff] rounded-xl border border-transparent cursor-pointer hover:bg-[#fafaf5] transition-all">
                <input className="w-5 h-5 text-[#25686a] border-[#bfc8c8] focus:ring-[#92d2d3] bg-[#fafaf5]" name="quiz" type="radio"/>
                <span className="ml-4 text-[#1a1c19]">Using global window variables</span>
              </label>
            </div>
            <div className="relative pt-1">
              <div className="overflow-hidden h-2 text-xs flex rounded bg-[#e3e3de]">
                <div className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#5f9ea0]" style={{width: "60%"}}></div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Step 4: URL Input */}
        <section className="w-full max-w-2xl mx-auto text-center" id="step-4">
          <h2 className="headline-text text-2xl font-bold mb-4">Sync existing course materials</h2>
          <p className="text-[#3f4849] mb-8">Paste a syllabus or course URL to let our AI build your schedule.</p>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <input className="w-full px-6 py-4 bg-[#eeeee9] rounded-full border-none focus:ring-4 focus:ring-[#92d2d3]/50 focus:bg-[#ffffff] transition-all text-[#1a1c19] placeholder:text-[#3f4849]/40" placeholder="https://university.edu/cs101/syllabus" type="text"/>
            </div>
            <button className="bg-[#25686a] text-white font-bold px-10 py-4 rounded-full shadow-lg hover:shadow-[#25686a]/30 transition-all active:scale-95">
              Parse with AI
            </button>
          </div>
        </section>
        
        {/* Step 5: Plan Preview */}
        <section className="w-full max-w-4xl mx-auto" id="step-5">
          <h2 className="headline-text text-3xl font-bold mb-10 text-center">Your 3-Day Sprint Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Day 1 */}
            <div className="glass-panel p-8 rounded-lg shadow-[0_20px_50px_rgba(63,72,73,0.06)] border border-white/20 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <span className="text-label text-xs font-bold text-[#cba72f] bg-[#4e3d00]/10 px-3 py-1 rounded-full uppercase tracking-tighter">Day 01</span>
                <span className="material-symbols-outlined text-[#25686a]">bolt</span>
              </div>
              <h3 className="headline-text text-xl font-bold mb-4 text-[#1a1c19]">Foundations & Setup</h3>
              <div className="space-y-4 mt-auto">
                <div className="flex items-center text-sm text-[#3f4849]">
                  <span className="material-symbols-outlined text-sm mr-2">check_circle</span>
                  <span>Environment Setup</span>
                </div>
                <div className="flex items-center text-sm text-[#3f4849]">
                  <span className="material-symbols-outlined text-sm mr-2">radio_button_unchecked</span>
                  <span>Git Workflow Review</span>
                </div>
              </div>
            </div>
            {/* Day 2 */}
            <div className="glass-panel p-8 rounded-lg shadow-[0_20px_50px_rgba(63,72,73,0.06)] border border-white/20 flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-[#735c00] shadow-[0_0_10px_rgba(115,92,0,0.4)]"></div>
              <div className="flex justify-between items-start mb-6">
                <span className="text-label text-xs font-bold text-[#cba72f] bg-[#4e3d00]/10 px-3 py-1 rounded-full uppercase tracking-tighter">Day 02</span>
                <span className="material-symbols-outlined text-[#25686a]">psychology</span>
              </div>
              <h3 className="headline-text text-xl font-bold mb-4 text-[#1a1c19]">Core Logic Patterns</h3>
              <div className="space-y-4 mt-auto">
                <div className="flex items-center text-sm text-[#3f4849]">
                  <span className="material-symbols-outlined text-sm mr-2">radio_button_unchecked</span>
                  <span>Functional JS Basics</span>
                </div>
                <div className="flex items-center text-sm text-[#3f4849]">
                  <span className="material-symbols-outlined text-sm mr-2">radio_button_unchecked</span>
                  <span>Map/Reduce Deep Dive</span>
                </div>
              </div>
            </div>
            {/* Day 3 */}
            <div className="glass-panel p-8 rounded-lg shadow-[0_20px_50px_rgba(63,72,73,0.06)] border border-white/20 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <span className="text-label text-xs font-bold text-[#cba72f] bg-[#4e3d00]/10 px-3 py-1 rounded-full uppercase tracking-tighter">Day 03</span>
                <span className="material-symbols-outlined text-[#25686a]">auto_awesome</span>
              </div>
              <h3 className="headline-text text-xl font-bold mb-4 text-[#1a1c19]">Async Mastery</h3>
              <div className="space-y-4 mt-auto">
                <div className="flex items-center text-sm text-[#3f4849]">
                  <span className="material-symbols-outlined text-sm mr-2">radio_button_unchecked</span>
                  <span>Promises & Fetch API</span>
                </div>
                <div className="flex items-center text-sm text-[#3f4849]">
                  <span className="material-symbols-outlined text-sm mr-2">radio_button_unchecked</span>
                  <span>Handling API Errors</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      
      {/* Footer Actions */}
      <div className="mt-24 w-full flex flex-col items-center">
        <a href="/dashboard" className="bg-[#25686a] text-white text-lg font-bold px-16 py-5 rounded-full shadow-[0_15px_30px_rgba(37,104,106,0.3)] hover:scale-105 transition-all mb-6 inline-block text-center">
          Start My Learning Journey
        </a>
        <p className="text-[#3f4849] text-sm font-medium">You can change these preferences anytime in settings.</p>
      </div>
      
      <footer className="w-full py-4 mt-12 bg-surface dark:bg-[#1a1c19] flex justify-between items-center px-8 border-t border-[#3f4849]/10">
        <div className="font-['Inter'] text-xs text-[#3f4849]/60">© 2024 DevPath. Systems Nominal.</div>
        <div className="flex flex-wrap gap-6">
          <a className="font-['Inter'] text-xs text-[#3f4849]/60 hover:text-[#25686a] transition-colors" href="#">Terms</a>
          <a className="font-['Inter'] text-xs text-[#3f4849]/60 hover:text-[#25686a] transition-colors" href="#">Privacy</a>
          <span className="font-['Inter'] text-xs text-[#3f4849]/60">Status: Online</span>
        </div>
      </footer>
    </main>
  );
}
