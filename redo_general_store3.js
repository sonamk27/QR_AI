const fs = require('fs');
let content = fs.readFileSync('components/customer/CustomerJourneyView.tsx', 'utf8');

// Find general-store section start
const startMarker = 'businessFeedback.layout === "general-store" ? (';
const startIdx = content.indexOf(generalStoreStart);
if (generalStoreStart < 0) {
  console.log('Could not find general-store section start');
  process.exit(1);
}

// Find the end: look for ") : businessFeedback.layout === "default" ? ("
// This is the end of the general-store section
const endMarker = ') : businessFeedback.layout === "default" ? (';
const endIdx = content.indexOf(endMarker, generalStoreStart);
if (generalEnd < 0) {
  console.log('Could not find general-store section end');
  process.exit(1);
}

const oldBlock = content.substring(generalStoreStart, generalEnd);

// New general store block
const newBlock = `<div key={question} className="relative overflow-hidden rounded-2xl border border-[#E8DFD1] bg-[#FAF7F2] p-5 shadow-sm hover:shadow-md transition-shadow duration-200" style={{ borderColor: businessFeedback.borderColor }}>
              {/* Cafe header image overlay */}
              <div className="absolute inset-0 h-[200px]">
                <img src="https://images.unsplash.com/photo-1495474472287-4d71bc020855?w=800&q=80" alt="General store" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#617B45]/80 to-transparent" />
              </div>
              <div className="relative z-10 pt-10 pb-8 px-6 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#617B45]/80">A little pause in your day</p>
                <h2 className="mt-1 font-serif text-3xl font-bold text-[#24211E] tracking-tight leading-tight">Rate Your Grocery Visit</h2>
                <p className="mt-0.5 text-[12px] font-medium text-[#617B45]/70">General Store</p>
                <div className="mt-6 flex items-center justify-center gap-2">
                  {restaurant.logoUrl ? (
                    <img src={restaurant.logoUrl} alt={restaurant.name} className="h-12 w-12 rounded-full border-2 border-white object-contain p-0.5" />
                  ) : (
                    <div className="h-12 w-12 rounded-full flex items-center justify-center border-2 border-[#E8DFD1] bg-white font-serif text-xl font-bold text-[#617B45] shadow-sm">
                      {restaurant.name.trim().charAt(0).toUpperCase() || "R"}
                    </div>
                  )}
                </div>
                <div className="mt-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#617B45]/70">Your visit, your way</p>
                  <h3 className="mt-1 font-serif text-xl font-bold text-[#24211E] tracking-tight">How was your grocery visit?</h3>
                  <p className="mt-1 text-[11px] text-[#716B64] leading-relaxed">
                    Tell us about your products, service, and time spent here.
                  </p>
                </div>
              </div>
              <div className="relative z-10 mt-8 px-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#617B45]">
                    <span className="text-[#617B45]">★</span>
                    Rate Your Grocery Experience
                  </span>
                </div>
                <div className="rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] px-4 py-3">
                  <div className="flex items-center justify-between mb-2 text-[10px] font-semibold text-[#716B64]">
                    <span>Your feedback notes</span>
                    <span className="text-[#617B45]">{reviewRatings.filter(Boolean).length} / 3 rated</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E8DFD1]">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: \${(reviewRatings.filter(Boolean).length / 3) * 100}%, backgroundColor: businessFeedback.accentColor }} />
                  </div>
                </div>

                <div className="space-y-3 text-left">
                  {businessFeedback.questions.map((question, index) => (
                    <div key={question} className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200" style={{ borderColor: businessFeedback.borderColor }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ backgroundColor: businessFeedback.softColor }} aria-hidden="true">{businessFeedback.questionIcons[index]}</span>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: businessFeedback.accentColor }}>{businessFeedback.aspectLabels[index]}</p>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-[#24211E]">{question}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: businessFeedback.borderColor }}>
                          <span className="shrink-0 text-[10px] font-medium text-[#716B64]">{reviewRatings[index] ? \${reviewRatings[index]} / 5 : "Tap to rate"}</span>
                          <RatingStars value={reviewRatings[index]} onChange={(rating) => updateReviewRating(index, rating)} label={question} size="md" activeColor={businessFeedback.accentColor} inactiveColor={businessFeedback.borderColor} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] text-[#716B64]" aria-live="polite">
                  {reviewRatings.filter(Boolean).length === 3
                    ? businessFeedback.ratingThankYou
                    : "Rate each part of your visit to help us serve you better."}
                </p>
              </div>
            </div>`;

content = content.substring(0, generalStoreStart) + newBlock + content.substring(generalStoreEnd);
fs.writeFileSync('components/customer/CustomerJourneyView.tsx', content);
console.log('General store replaced successfully!');
