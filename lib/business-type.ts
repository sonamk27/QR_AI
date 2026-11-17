export const BUSINESS_TYPES = ["RESTAURANT", "CAFE", "SALON", "GENERAL_STORE"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RESTAURANT: "Restaurant",
  CAFE: "Cafe",
  SALON: "Salon",
  GENERAL_STORE: "General Store",
};

export const BUSINESS_FEEDBACK_CONFIG = {
  RESTAURANT: {
    layout: "restaurant",
    displayLabel: "Restaurant",
    welcomeHeadline: ["Good Food", "Brings People Together"],
    welcomeSupportingText: "Join our loyalty program and enjoy exclusive rewards.",
    welcomeBadges: ["Book a Table", "Rewards", "Offers", "Menu"],
    aspectLabels: ["Food Quality", "Service", "Ambience"],
    questions: ["Tell us about the food and drinks.", "How was the restaurant service?", "How was the atmosphere?"],
    questionIcons: ["🍽️", "👋", "✨"],
    reviewHeading: "How was your experience?",
    reviewTopbar: "Rate Your Restaurant Visit",
    reviewPrompt: "Tell us about your dining experience.",
    reviewInstruction: "Rate your dining experience",
    ratingThankYou: "Thanks for rating your visit!",
    pageColor: "#F7F2E9",
    accentColor: "#173B29",
    accentHoverColor: "#102D20",
    softColor: "#F4EDDE",
    borderColor: "#DED4BE",
    heroIcon: "🍴",
    heroEyebrow: "A GOOD MEAL BRINGS PEOPLE TOGETHER",
    heroMessage: "Good food, shared together.",
  },
  CAFE: {
    layout: "cafe",
    displayLabel: "Cafe",
    welcomeHeadline: ["Good Coffee", "Brings People Together"],
    welcomeSupportingText: "Settle in, enjoy something lovely, and collect rewards along the way.",
    welcomeBadges: ["Stamp Rewards", "Share Moments", "Cozy Visits"],
    aspectLabels: ["Drinks & Food", "Service", "Atmosphere"],
    questions: ["How were your drinks and treats?", "How was the cafe service?", "Was the cafe comfortable and welcoming?"],
    questionIcons: ["☕", "🤎", "🌿"],
    reviewHeading: "How was your cafe visit?",
    reviewTopbar: "Rate Your Café Visit",
    reviewPrompt: "Share your thoughts on drinks, food, service, and the cafe vibe.",
    reviewInstruction: "Rate your visit",
    ratingThankYou: "Thanks for sharing your cafe experience!",
    pageColor: "#FBF4E6",
    accentColor: "#5B7A52",
    accentHoverColor: "#4A6B47",
    softColor: "#EAF0E3",
    borderColor: "#D9E1D2",
    heroIcon: "☕",
    heroEyebrow: "CAFÉ LOYALTY",
    heroMessage: "A warm cup, a warm welcome.",
  },
  SALON: {
    layout: "salon",
    displayLabel: "Salon",
    welcomeHeadline: ["Good Things", "Together"],
    welcomeSupportingText: "Book more, earn more, and enjoy great rewards with every visit.",
    welcomeBadges: ["Book Appointment", "Exclusive Offers", "Loyalty Rewards", "Beauty Tips"],
    aspectLabels: ["Service Quality", "Ambience", "Staff Friendliness"],
    questions: ["How was the quality of your service?", "How was the salon ambience?", "How friendly and helpful was the team?"],
    questionIcons: ["✂️", "✨", "🪞"],
    reviewHeading: "How was your experience?",
    reviewTopbar: "Rate Your Salon Visit",
    reviewPrompt: "Tell us about your service, ambience and staff.",
    reviewInstruction: "Rate your salon experience",
    ratingThankYou: "Thanks for rating your visit!",
    pageColor: "#FCF2EB",
    accentColor: "#60341F",
    accentHoverColor: "#4A2819",
    softColor: "#F6E6DA",
    borderColor: "#EAD2C2",
    heroIcon: "✂️",
    heroEyebrow: "A MOMENT THAT'S ALL YOURS",
    heroMessage: "Care that starts with you.",
  },
  GENERAL_STORE: {
    layout: "general-store",
    displayLabel: "General Store",
    welcomeHeadline: ["Good Things", "Together"],
    welcomeSupportingText: "Shop more, earn more, and enjoy great rewards with every purchase.",
    welcomeBadges: ["Great Deals", "Loyal Customers", "Better Savings"],
    aspectLabels: ["Shopping Experience", "Product Quality", "Staff Helpfulness"],
    questions: ["How was your overall shopping experience?", "How was the quality of the products?", "How helpful was the staff?"],
    questionIcons: ["🛍️", "📦", "🙂"],
    reviewHeading: "How was your shopping experience?",
    reviewTopbar: "Rate Your Store Visit",
    reviewPrompt: "Your feedback helps us serve you better!",
    reviewInstruction: "Rate your shopping experience",
    ratingThankYou: "Thanks for rating your shopping experience!",
    pageColor: "#F7F5E8",
    accentColor: "#5F7A48",
    accentHoverColor: "#4C6439",
    softColor: "#E9EFDD",
    borderColor: "#DCE3CA",
    heroIcon: "🛍️",
    heroEyebrow: "EVERYDAY GOODS, MADE EASY",
    heroMessage: "The right things, close to home.",
  },
} as const;

export function getBusinessType(value: unknown): BusinessType {
  if (typeof value !== "string") return "RESTAURANT";
  const normalized = value.trim().toUpperCase();
  if (normalized === "CAFE" || normalized === "CAFÉ") return "CAFE";
  if (normalized === "SALON" || normalized === "SALOON") return "SALON";
  if (["GENERAL_STORE", "GENERAL STORE", "GROCERY STORE", "STORE"].includes(normalized)) return "GENERAL_STORE";
  return "RESTAURANT";
}

export function getBusinessFeedbackConfig(value: unknown) {
  return BUSINESS_FEEDBACK_CONFIG[getBusinessType(value)];
}
