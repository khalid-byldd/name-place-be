import { Router, Request, Response, NextFunction } from "express";
import { openaiService } from "../modules/openai/openai.service";
import { openaiPrompts, jsonSchemas } from "../utils/openai.prompts";

const router = Router();

/**
 * Example 2: JSON response with schema validation
 * POST /api/v1/ai/validate-answers
 */
router.post(
  "/validate-answers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { systemPrompt } = openaiPrompts.validateAnswers(req.body);

      const result = await openaiService.chatCompletion({
        prompt: `Here are the categories and answers to validate: ${req.body}`,
        systemPrompt,
        jsonSchema: jsonSchemas.answerValidation,
      });

      res.json({
        data: JSON.parse(result.content).answers,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
