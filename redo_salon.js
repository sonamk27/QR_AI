const fs = require('fs');
let content = fs.readFileSync('components/customer/CustomerJourneyView.tsx', 'utf8');

// Find the welcome page section start
const welcomeStart = content.indexOf('{currentView === "welcome" && (');
if (cafeStart < 0) {
  console.log('Could not find welcome page start');
  process.exit(1);
}

// Find the end of welcome section - look for </main> after welcome
const welcomeEnd = content.indexOf('{currentView === "register" && (');
if (welcomeEnd < 0) {
  console.log('Could not find welcome section end');
  process.exit(1);
}

const oldBlock = content.substring(welcomeStart, welcomeEnd);

const newBlock = `{currentView === "welcome" && (
        <main className={\`customer-journey-salon min-h-screen flex flex-col items-center justify-center px-5 py-6 ${isCafeFeedback ? "cafe-welcome" : ""}\`}>
          {/* Top Header Bar */}
          <header className="w-full flex items-center justify-between px-4 py-3">
            <button
              className="rounded-full bg-white/80 p-2 text-[#B58A4B] hover:bg-[#F7F2E9] transition"
              onClick={() => setCurrentView("card")}
            >
              <span className="text-xl">←</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8DFD1] text-2xl text-[#B58A4B] shadow-sm">
                  ✂️
                </div>
                <div>
                  <p className="text-xs font-bold text-[#24211E] leading-tight">{restaurant.name}</p>
                  <p className="text-[10px] font-medium text-[#716B64]">SALON • ABC</p>
                </div>
              </div>
              <span className="text-xl">📍</span>
            </div>
          </header>

          {/* Hero Content */}
          <main className="flex-1 flex flex-col items-center justify-center py-4 px-6">
            {/* Visit Card */}
            <div className="w-full rounded-2xl border border-[#E8DFD1] bg-[#FAF7F2] p-6 shadow-sm mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B47]">VISIT CARD</span>
                <span className="rounded-full bg-[#4A6B47] text-white text-[10px] font-bold px-2 py-1">₹100 Off Your Bill</span>
              </div>
              <div className="flex items-center justify-between gap-6 mb-4">
                <div className="flex flex-col items-center text-center">
                  <span className="text-[9px] font-bold text-[#4A6B47]">01</span>
                  <p className="text-xs font-semibold text-[#716B64]">Service</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-[9px] font-bold text-[#4A6B47]">02</span>
                  <p className="text-xs font-semibold text-[#716B64]">Results</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-[9px] font-bold text-[#4A6B47]">03</span>
                  <p className="text-xs font-semibold text-[#716B64]">Relax</p>
                </div>
              </div>
              <h1 className="mt-4 font-serif text-3xl font-bold text-[#24211E] tracking-tight leading-tight">Good Food<br />Brings People Together</h3>
              <p className="mt-2 text-xs text-[#716B64] text-center leading-relaxed">
                Join our loyalty program and share your experience with the world.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#B58A4B]">★</span>
                  <span className="text-xs font-semibold text-[#716B64]">Great Service</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#B58A4B]">❤️</span>
                  <span className="text-xs font-semibold text-[#716B64]">Skilled Team</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#B58A4B]">✨</span>
                  <span className="text-xs font-semibold text-[#716B64]">Self Care</span>
                </div>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="mt-6 font-serif text-4xl font-bold text-[#24211E] tracking-tight leading-tight text-center">Good Food<br />Brings People Together</h1>
            <p className="mt-2 text-xs text-[#716B64] text-center leading-relaxed">
              Join our loyalty program and share your experience with the world.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col gap-3 w-full px-4">
              <button
                onClick={() => {
                  setRegistrationDestination("collect_stamp");
                  setCurrentView("register");
                }}
                disabled={collectingStamp}
                className={`customer-collect-stamp-button flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60`}
                style={{ backgroundColor: businessFeedback.accentColor }}
                onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.accentHoverColor; }}
                onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.accentColor; }}
              >
                <span className="customer-collect-stamp-icon flex h-7 w-7 items-center justify-center rounded-full text-sm" aria-hidden="true">★</span>
                <span>{collectingStamp ? "Collecting Stamp..." : "Collect My Stamp"}</span>
              </button>

              <button
                onClick={() => {
                  setRegistrationDestination("review");
                  setCurrentView("register");
                }}
                className={`w-full rounded-2xl border border-[#E8DFD1] bg-white py-3.5 text-sm font-bold text-[#24211E] shadow-2xs transition active:scale-[0.98] flex items-center justify-center gap-2`}
                style={{ borderColor: businessFeedback.borderColor }}
                onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.softColor; }}
                onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "#FFFFFF"; }}
              >
                <span>⭐</span>
                <span>Share Your Experience</span>
              </button>
            </div>
          </main>
        </main>
`);

content = content.substring(0, welcomeStart) + newBlock + content.substring(welcomeEnd);
fs.writeFileSync('components/customer/CustomerJourneyView.tsx', content);
console.log('Welcome page replaced successfully');
