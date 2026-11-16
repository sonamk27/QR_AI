const fs = require('fs');
let content = fs.readFileSync('components/customer/CustomerJourneyView.tsx', 'utf8');

// Find the general-store section
const generalStoreStart = content.indexOf('businessFeedback.layout === "general-store" ? (');
if (generalStoreStart < 0) {
  console.log('Could not find general-store section start');
  process.exit(1);
}

// Find the end - look for the closing of this div section
// Count braces to find the matching close
let depth = 0;
let inString = false;
let escapeNext = false;
let generalStoreEnd = -1;

for (let i = generalStoreStart; i < content.length; i++) {
  const ch = content[i];
  if (escapeNext) { escapeNext = false; continue; }
  if (ch === '\\') { escapeNext = true; continue; }
  if (inString) {
    if (ch === inString) inString = false;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
  
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) {
      // Check if next chars are ') : businessFeedback'
      const remaining = content.substring(i + 1, i + 40);
      if (remaining.includes(') : businessFeedback')) {
        generalStoreEnd = i + 1;
        break;
      }
    }
  }
}

if (generalStoreEnd < 0) {
  console.log('Could not find general-store section end marker');
  process.exit(1);
}

const newBlock = `<div key={question} className="relative overflow-hidden rounded-2xl border border-[#E8DFD1] bg-[#F7F2E9] p-5 shadow-sm" style={{ borderColor: businessFeedback.borderColor }}>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B47]">MY REWARDS</span>
                          <span className="flex h-6 w-10 items-center justify-center rounded-full bg-[#4A6B47] text-white text-xs">⭐</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[#24211E]">MY REWARDS</span>
                          <span className="text-[10px] font-medium text-[#B58A4B]">Review</span>
                        </div>
                      </div>
                      
                      {/* Loyalty Pass Header */}
                      <div className="relative overflow-hidden rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] p-4 mb-3">
                        <div className="absolute inset-0 h-[90px]">
                          <img src="https://images.unsplash.com/photo-1556228578-0d85b486a938?w=600&q=80" alt="Grocery store" className="w-full h-full object-cover opacity-40" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#4A6B47]/60 to-transparent" />
                        </div>
                        <div className="relative z-10 pt-4 px-4 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B47]">YOUR LOYALTY PASS</p>
                          <h3 className="mt-1 font-serif text-xl font-bold text-[#24211E] tracking-tight">hello</h3>
                          <p className="text-[10px] font-medium text-[#716B64]">${restaurant.name}</p>
                          <div className="mt-2 flex items-center justify-center gap-2">
                            <span className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-[#4A6B47]">${qrData?.currentStamps || 0}/10</span>
                              <span className="text-[9px] font-medium text-[#4A6B47]">STAMPS</span>
                            </span>
                            <span className="text-[10px] font-medium text-[#4A6B47]">${Math.max(0, 10 - (qrData?.currentStamps || 0))}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Basket Icon */}
                      <div className="mt-4 flex items-center justify-center gap-6 p-4">
                        <span className="text-2xl">🛒</span>
                        <div className="flex items-center gap-2 text-xs font-medium text-[#4A6B47]">
                          <span className="text-[10px] font-bold text-[#4A6B47]">${reviewRatings.filter(Boolean).length}</span>
                          <span className="text-xs text-[#716B64]">stamps to go</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full h-2 overflow-hidden rounded-full bg-[#E8DFD1] mb-3">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: \${(reviewRatings.filter(Boolean).length / 10) * 100}%, backgroundColor: businessFeedback.accentColor }} />
                      </div>
                      
                      {/* Today's Stamp Collected */}
                      {reviewRatings.filter(Boolean).length > 0 && (
                        <div className="rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-4 py-3 mt-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🎁</span>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-[#4A6B47]">Today's Visit Stamp Collected!</p>
                              <p className="text-[10px] text-[#716B64]">Collect 9 more stamps to unlock ₹100 Off Your Bill.</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          onClick={() => setCurrentView("card")}
                          className="flex items-center justify-between rounded-full border border-[#E8DFD1] bg-white px-4 py-3 text-xs font-bold text-[#716B64] shadow-sm hover:bg-[#FAF7F2] transition"
                        >
                          <span>View Reward Details</span>
                          <span className="text-[10px] font-bold text-[#4A6B47]">›</span>
                        </button>
                        <button
                          onClick={() => setCurrentView("dashboard")}
                          className="flex items-center justify-center gap-2 rounded-full border border-[#E8DFD1] bg-white px-4 py-3 text-xs font-bold text-[#716B64] shadow-sm hover:bg-[#FAF7F2] transition"
                        >
                          <span>⏱</span>
                          <span>Visit History (1)</span>
                        </button>
                      </div>
                      
                      {/* Bottom Navigation */}
                      <div className="mt-6 flex items-center justify-between px-2 text-xs font-semibold text-[#716B64]">
                        <div className="flex items-center gap-1.5 text-[#716B64]">
                          <span className="text-[10px] font-bold text-[#4A6B47]">SHOP</span>
                          <span className="text-[10px] font-medium text-[#B58A4B]">•</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#4A6B47]">
                          <span className="text-[10px] font-bold text-[#4A6B47]">COLLECT</span>
                          <span className="text-[10px] font-medium text-[#716B64]">•</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#716B64]">
                          <span className="text-[10px] font-bold text-[#716B64]">REDEEM</span>
                        </div>
                      </div>
                    </div>`;

content = content.substring(0, cafeStart) + newBlock + content.substring(cafeEnd);
fs.writeFileSync('components/customer/CustomerJourneyView.tsx', content);
console.log('Cafe card replaced successfully');
