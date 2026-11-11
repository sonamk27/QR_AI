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
    welcomeSupportingText: "Join our loyalty program and share your experience with the world.",
    welcomeBadges: ["Great Food", "Kind People", "Better Together"],
    aspectLabels: ["Food", "Service", "Atmosphere"],
    questions: ["How did you enjoy the food?", "How was the restaurant service?", "Was the dining area comfortable?"],
    questionIcons: ["🍽️", "🤝", "✨"],
    reviewHeading: "How was your visit?",
    reviewTopbar: "Share Your Experience",
    reviewPrompt: "Tell us what you enjoyed. Your honest feedback helps the team make every visit better.",
    reviewInstruction: "Rate your experience",
    ratingThankYou: "Thanks for rating your visit!",
    pageColor: "#F7F2E9",
    accentColor: "#B58A4B",
    accentHoverColor: "#9E7438",
    softColor: "#FAF5ED",
    borderColor: "#E8DFD1",
    heroIcon: "🍽️",
    heroEyebrow: "A GOOD MEAL BRINGS PEOPLE TOGETHER",
    heroMessage: "Good food, shared together.",
  },
  CAFE: {
    layout: "cafe",
    displayLabel: "Cafe",
    welcomeHeadline: ["Good Coffee", "Brings People Together"],
    welcomeSupportingText: "Settle in, enjoy something lovely, and collect rewards along the way.",
    welcomeBadges: ["Great Coffee", "Kind People", "Better Together"],
    aspectLabels: ["Drinks and food", "Service", "Atmosphere"],
    questions: ["How were your drinks and treats?", "How was the cafe service?", "Was the cafe comfortable and welcoming?"],
    questionIcons: ["☕", "🙂", "🌿"],
    reviewHeading: "How was your cafe visit?",
    reviewTopbar: "Rate Your Cafe Visit",
    reviewPrompt: "Tell us about your drinks, treats, and time spent here.",
    reviewInstruction: "Rate your cafe experience",
    ratingThankYou: "Thanks for rating your visit!",
    pageColor: "#FBF4E6",
    accentColor: "#5B7A52",
    accentHoverColor: "#4A6B47",
    softColor: "#EAF0E3",
    borderColor: "#D9E1D2",
    heroIcon: "☕",
    heroEyebrow: "YOUR LITTLE PAUSE IN THE DAY",
    heroMessage: "Find your favorite sip.",
  },
  SALON: {
    layout: "salon",
    displayLabel: "Salon",
    welcomeHeadline: ["Feel Good", "Look Your Best"],
    welcomeSupportingText: "Make time for yourself, share how you felt, and enjoy rewards on your next visit.",
    welcomeBadges: ["Great Service", "Skilled Team", "Self Care"],
    aspectLabels: ["Stylist service", "Results", "Salon environment"],
    questions: ["How was your stylist or technician?", "How do you feel about your results?", "Was the salon comfortable and relaxing?"],
    questionIcons: ["✂️", "✨", "🪞"],
    reviewHeading: "How was your salon experience?",
    reviewTopbar: "Tell Us About Your Visit",
    reviewPrompt: "Tell us how you felt about your service and results.",
    reviewInstruction: "Your experience, step by step",
    ratingThankYou: "Thanks for rating your visit!",
    pageColor: "#FFF4F7",
    accentColor: "#B55B7A",
    accentHoverColor: "#93445F",
    softColor: "#FBE7ED",
    borderColor: "#F0D1DB",
    heroIcon: "✂️",
    heroEyebrow: "A MOMENT THAT'S ALL YOURS",
    heroMessage: "Care that starts with you.",
  },
  GENERAL_STORE: {
    layout: "general-store",
    displayLabel: "General Store",
    welcomeHeadline: ["Find What You Need", "Feel Good About It"],
    welcomeSupportingText: "Tell us about the products, value, and helpful service you found here.",
    welcomeBadges: ["Everyday Essentials", "Helpful Team", "Good Value"],
    aspectLabels: ["Product quality", "Product availability", "Staff helpfulness"],
    questions: ["Were the products good quality?", "Could you find what you needed?", "Was the staff helpful?"],
    questionIcons: ["🛍️", "📦", "🙂"],
    reviewHeading: "How was your shopping experience?",
    reviewTopbar: "Rate Your Shopping Experience",
    reviewPrompt: "Tell us about the products you found, their quality and value, and the help you received.",
    reviewInstruction: "Rate your shopping experience",
    ratingThankYou: "Thanks for rating your shopping experience!",
    pageColor: "#F3F6EC",
    accentColor: "#617B45",
    accentHoverColor: "#4D6535",
    softColor: "#E8EEDC",
    borderColor: "#D8E1C9",
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
