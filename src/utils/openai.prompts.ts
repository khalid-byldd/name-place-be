/**
 * Predefined prompts for common use cases
 * Can be extended based on your needs
 */

export const openaiPrompts = {
  // Example: Validate player answers
  validateAnswers: (answer: any) => ({
    systemPrompt: `You are evaluating answers for a word game.

Rules:
- Each round has:
  - One letter
  - Exactly 4 categories
- Players must give one answer per category.
- Each answer must:
  1. Start with the given letter (case-insensitive)
  2. Belong correctly to the given category
- Each correct answer = 10 points
- Each incorrect or invalid answer = 0 points
- Maximum score per player = 40

Evaluation guidelines:
- Be strict but reasonable (e.g., common knowledge is acceptable)
- Ignore capitalization differences
- Reject answers that:
  - Do not start with the given letter
  - Do not fit the category
  - Are empty or nonsense

Input format:
{
  "round_letter": "K",
  "round_categories": ["cars","fruits","actors","veggies"],
  "answers": [
    {
      "playerId": 75,
      "answers": ["kia","kiwi","keanu","kale"],
      "scores": 0
    }
  ]
}

Task:
- Evaluate each answer in order against its category
- Add 10 points for each correct answer
- Update the "scores" field with the total

Output format (strict JSON only, no explanation):
{
  "answers": [
    {
      "playerId": 75,
      "answers": ["orginal answers here"],
      "scores": 40
    }
  ]
}

Here are the some of the answers to validate:
${JSON.stringify(answer)}
`,
  }),
};

// JSON Schemas for structured responses

export const jsonSchemas = {
  // Answer validation schema
  answerValidation: {
    type: "object",
    properties: {
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            playerId: { type: "number" },
            answers: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
            },
            scores: { type: "number" },
          },
          required: ["playerId", "answers", "scores"],
        },
      },
    },
    required: ["answers"],
  },
};
