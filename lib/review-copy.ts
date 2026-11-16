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
          `I had a great time at ${input.businessName}.`,
          `My visit to ${input.businessName} was a very positive one.`,
          `I was happy with my experience at ${input.businessName}.`,
          `${input.businessName} left me with a great impression.`,
        ]
      : input.overall >= 4
        ? [
            `I had a very good experience at ${input.businessName}.`,
            `I enjoyed my visit to ${input.businessName}.`,
            `My time at ${input.businessName} was pleasant overall.`,
            `I had a really pleasant visit to ${input.businessName}.`,
            `${input.businessName} made a good impression on me.`,
            `I was pleased with my experience at ${input.businessName}.`,
            `My visit to ${input.businessName} was a positive one.`,
          ]
        : input.overall >= 3
          ? [
              `My experience at ${input.businessName} was okay overall.`,
              `My visit to ${input.businessName} was fine, with room to improve.`,
              `I had a mixed experience at ${input.businessName}.`,
              `My time at ${input.businessName} was reasonable overall.`,
              `There were good parts to my visit to ${input.businessName}.`,
              `My visit to ${input.businessName} was average overall.`,
              `I had an okay visit to ${input.businessName}.`,
            ]
          : input.overall >= 2
            ? [
                `My experience at ${input.businessName} fell short.`,
                `I left ${input.businessName} feeling disappointed.`,
                `There were several things that could have gone better at ${input.businessName}.`,
                `My visit to ${input.businessName} could have been better.`,
                `I was underwhelmed by my experience at ${input.businessName}.`,
                `I expected a better experience at ${input.businessName}.`,
                `My time at ${input.businessName} was disappointing.`,
              ]
            : [
                `I was very disappointed with my experience at ${input.businessName}.`,
                `Unfortunately, my visit to ${input.businessName} did not go well.`,
                `My experience at ${input.businessName} needs significant improvement.`,
                `I had a very poor experience at ${input.businessName}.`,
                `My visit to ${input.businessName} was a letdown.`,
                `I left ${input.businessName} very dissatisfied.`,
                `Unfortunately, ${input.businessName} did not meet my expectations.`,
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
          `I was pleased with the ${best}`,
          `The ${best} made a positive impression on me`,
        ],
        variation,
        2,
      );
      const improvementPart = choose(
        [
          `the ${needsWork} could use some improvement`,
          `the ${needsWork} fell short for me`,
          `the ${needsWork} could have been better`,
          `I was less satisfied with the ${needsWork}`,
          `the ${needsWork} did not meet my expectations`,
          `the ${needsWork} was not as strong`,
          `the ${needsWork} needs more attention`,
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
      const sentenceOptions =
        average >= 4
          ? [
              `I appreciated the ${labels}.`,
              `I was pleased with the ${labels}.`,
              `I especially liked the ${labels}.`,
              `${subject} made a positive impression on me.`,
              `I found the ${labels} enjoyable.`,
              `${subject} added to an enjoyable visit.`,
              `I was happy with the ${labels}.`,
              `${subject} ${verb} a highlight of my visit.`,
              `I came away with a positive impression of the ${labels}.`,
              `I enjoyed the ${labels} throughout my visit.`,
              `${subject} met my expectations.`,
            ]
          : average >= 3
            ? [
                `${subject} ${verb} fine overall.`,
                `I found the ${labels} satisfactory overall.`,
                `My impression of the ${labels} was mixed.`,
                `${subject} met my basic expectations.`,
                `There is room to improve the ${labels}.`,
                `${subject} ${verb} acceptable, though not especially memorable.`,
                `I had an average experience with the ${labels}.`,
                `Overall, I felt neutral about the ${labels}.`,
                `${subject} ${verb} okay, with some room to improve.`,
                `I thought the ${labels} ${verb} reasonable.`,
                `${subject} ${verb} neither a highlight nor a major concern.`,
              ]
            : average >= 2
              ? [
                  `${subject} could have been better.`,
                  `I was not fully satisfied with the ${labels}.`,
                  `${subject} fell below my expectations.`,
                  `I found the ${labels} disappointing.`,
                  `There is room for improvement in the ${labels}.`,
                  `I hoped for a better experience with the ${labels}.`,
                  `I was underwhelmed by the ${labels}.`,
                  `${subject} did not meet my expectations.`,
                  `I expected more from the ${labels}.`,
                  `${subject} ${verb} not as good as I had hoped.`,
                  `I left feeling let down by the ${labels}.`,
                ]
              : [
                  `${subject} ${verb} disappointing.`,
                  `I was very dissatisfied with the ${labels}.`,
                  `${subject} fell well short of expectations.`,
                  `I had a very poor experience with the ${labels}.`,
                  `${subject} ${ratings.length === 1 ? "needs" : "need"} significant improvement.`,
                  `I was deeply disappointed by the ${labels}.`,
                  `The ${labels} made for a frustrating experience.`,
                  `${subject} ${ratings.length === 1 ? "was" : "were"} far below what I expected.`,
                  `I cannot say I was satisfied with the ${labels}.`,
                  `${subject} ${ratings.length === 1 ? "was" : "were"} a major letdown.`,
                  `I left with a very negative impression of the ${labels}.`,
                ];
      aspectSentence = choose(sentenceOptions, variation, 2);
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
