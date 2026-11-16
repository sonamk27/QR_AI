const fs = require('fs');
let content = fs.readFileSync('components/customer/CustomerJourneyView.tsx', 'utf8');

// Find the cafe card section start
const cafeStart = content.indexOf('businessFeedback.layout === "cafe" ? (');
if (cafeStart < 0) {
  console.log('Could not find cafe card section start');
  process.exit(1);
}

// Find the end - look for the pattern that closes the cafe section
// The cafe section ends with: ) : businessFeedback.layout === "general-store" ? (
const cafeEndMarker = ') : businessFeedback.layout === "general-store" ? (';
const cafeEnd = content.indexOf(cafeEndMarker, cafeStart);
if (cafeEnd < 0) {
  console.log('Could not find cafe section end marker');
  process.exit(1);
}

const oldBlock = content.substring(cafeStart, cafeEnd);

// New cafe card block - using template literals properly
const newBlock = `<div key={question} className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200" style={{ borderColor: businessFeedback.borderColor }}>
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
                    </div>`;

content = content.substring(0, cafeStart) + newBlock + content.substring(cafeEnd);
fs.writeFileSync('components/customer/CustomerJourneyView.tsx', content);
console.log('Cafe card replaced successfully');
