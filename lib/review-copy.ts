type AspectScore = {
  label: string;
  score: number | null | undefined;
};

type ReviewCopyInput = {
  businessName: string;
  overall: number;
  aspects: AspectScore[];
  details?: string[];
  customerText?: string | null;
  variation?: string | number;
};

function variationHash(value: string | number | undefined): number {
  if (typeof value === "number") return Math.abs(value);
  return (value ?? "").split("").reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
    7,
  );
}

function joinLabels(labels: string[]): string {
  if (labels.length < 2) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function choose<T>(options: T[], variation: number, offset = 0): T {
  return options[(variation + offset) % options.length];
}

export function createReviewDraft(input: ReviewCopyInput): string {
  const variation = variationHash(input.variation);
  const openingOptions =
    input.overall >= 5
      ? [
          `I had a wonderful experience at ${input.businessName}.`,
          `I really enjoyed my time at ${input.businessName}.`,
          `${input.businessName} made for a lovely visit.`,
        ]
      : input.overall >= 4
        ? [
            `I had a very good experience at ${input.businessName}.`,
            `I enjoyed my visit to ${input.businessName}.`,
            `My time at ${input.businessName} was pleasant overall.`,
          ]
        : input.overall >= 3
          ? [
              `My experience at ${input.businessName} was okay overall.`,
              `My visit to ${input.businessName} was fine, with room to improve.`,
              `I had a mixed experience at ${input.businessName}.`,
            ]
          : input.overall >= 2
            ? [
                `My experience at ${input.businessName} fell short.`,
                `I left ${input.businessName} feeling disappointed.`,
                `There were several things that could have gone better at ${input.businessName}.`,
              ]
            : [
                `I was very disappointed with my experience at ${input.businessName}.`,
                `Unfortunately, my visit to ${input.businessName} did not go well.`,
                `My experience at ${input.businessName} needs significant improvement.`,
              ];

  const ratings = input.aspects.filter(
    (aspect): aspect is { label: string; score: number } =>
      typeof aspect.score === "number" && aspect.score >= 1 && aspect.score <= 5,
  );
  let aspectSentence = "";

  if (ratings.length > 0) {
    const highest = Math.max(...ratings.map((aspect) => aspect.score));
    const lowest = Math.min(...ratings.map((aspect) => aspect.score));
    if (highest - lowest >= 2) {
      const strongest = ratings.filter((aspect) => aspect.score === highest);
      const weakest = ratings.filter((aspect) => aspect.score === lowest);
      const best = choose(strongest, variation).label.toLowerCase();
      const needsWork = choose(weakest, variation, 1).label.toLowerCase();
      const positivePart = choose(
        [
          `The ${best} stood out`,
          `I especially appreciated the ${best}`,
          `I was particularly happy with the ${best}`,
        ],
        variation,
        2,
      );
      const improvementPart = choose(
        [
          `the ${needsWork} could use some improvement`,
          `the ${needsWork} fell short for me`,
          `the ${needsWork} could have been better`,
        ],
        variation,
        3,
      );
      aspectSentence = `${positivePart}, although ${improvementPart}.`;
    } else {
      const labels = joinLabels(ratings.map((aspect) => aspect.label.toLowerCase()));
      const average = ratings.reduce((sum, aspect) => sum + aspect.score, 0) / ratings.length;
      const subject = `The ${labels}`;
      const verb = ratings.length === 1 ? "was" : "were";
      aspectSentence =
        average >= 4
          ? `I appreciated the ${labels}.`
          : average >= 3
            ? `${subject} ${verb} fine overall.`
            : average >= 2
              ? `${subject} ${verb} below what I hoped for.`
              : `${subject} ${verb} disappointing.`;
    }
  }

  const customerText = input.customerText?.trim();
  const detailSentence = customerText
    ? /[.!?]$/.test(customerText) ? customerText : `${customerText}.`
    : input.details?.length
      ? `I also appreciated ${joinLabels(input.details.slice(0, 3).map((detail) => detail.toLowerCase()))}.`
      : "";

  return [
    choose(openingOptions, variation),
    aspectSentence,
    detailSentence,
  ].filter(Boolean).join(" ");
}
