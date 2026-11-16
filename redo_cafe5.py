#!/usr/bin/env python3
import sys

with open('components/customer/CustomerJourneyView.tsx', 'r') as f:
    content = f.read()

# Find the cafe card section
cafe_start = content.find('businessFeedback.layout === "cafe" ? (')
if cafeStart < 0:
    print("Could not find cafe start")
    sys.exit(1)

# Find where the cafe section ends - right before "businessFeedback.layout === \"general-store\" ? ("
cafe_end_marker = ') : businessFeedback.layout === "general-store" ? ('
cafe_end = content.find(cafe_end_marker, cafe_start)
if cafe_end < 0:
    print("Could not find cafe end marker")
    sys.exit(1)

old_block = content[cafe_start:cafe_end]
print(f"Old block length: {len(old_block)}")

# New cafe card block - properly formatted with correct JSX
new_block = '''<div key={question} className="rounded-2xl border border-[#E8DFD1] bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200" style={{ borderColor: businessFeedback.borderColor }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ backgroundColor: businessFeedback.softColor }} aria-hidden="true">{businessFeedback.questionIcons[index]}</span>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: businessFeedback.accentColor }}>{businessFeedback.aspectLabels[index]}</p>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-[#24211E]">{question}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: businessFeedback.borderColor }}>
                          <span className="shrink-0 text-[10px] font-medium text-[#716B64]">{reviewRatings[index] ? `${reviewRatings[index]} / 5` : "Tap to rate"}</span>
                          <RatingStars value={reviewRatings[index]} onChange={(rating) => updateReviewRating(index, rating)} label={question} size="md" activeColor={businessFeedback.accentColor} inactiveColor={businessFeedback.borderColor} />
                        </div>
                      </div>
                    </div>'''

content = content[:cafe_start] + new_block + content[cafe_end:]
with open('components/customer/CustomerJourneyView.tsx', 'w') as f:
    f.write(content)

print("Replacement successful!")
