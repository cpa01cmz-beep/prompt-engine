import { z } from "zod";

export const PromptInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  role: z.string().optional(),
  variables: z.array(z.string()).optional(),
  constraints: z.string().optional(),
  examples: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const PromptUpdateSchema = PromptInputSchema.partial();

export const TemplateInputSchema = z.object({
  name: z.string().min(1),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
});

export const TemplateUpdateSchema = TemplateInputSchema.partial();

export const SkillInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  tools: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const SkillUpdateSchema = SkillInputSchema.partial();

export const EvaluationInputSchema = z.object({
  targetType: z.enum(["prompt", "skill"]),
  targetId: z.string().min(1),
  score: z.number().nullable().optional(),
  feedback: z.unknown().optional(),
  model: z.string().optional(),
});

export const SettingsInputSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export const SettingsValueSchema = z.object({
  // `undefined` is not a representable JSON value, so a missing/undefined
  // value is not a valid setting payload (it would otherwise make
  // JSON.stringify return `undefined` and crash the size check).
  value: z.unknown().refine((v) => v !== undefined, { message: "value is required" }),
});

// AI request bodies
export const AiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export const ChatRequestSchema = z.object({
  messages: z.array(AiMessageSchema).min(1),
});

export const GeneratePromptSchema = z.object({
  goal: z.string().min(1),
});

export const EvaluatePromptSchema = z.object({
  prompt: z.string().min(1),
});

export const OptimizePromptSchema = z.object({
  prompt: z.string().min(1),
});

export const GenerateSkillSchema = z.object({
  goal: z.string().min(1),
});

export const EvaluateSkillSchema = z.object({
  skill: z.string().min(1),
});

export const OptimizeSkillSchema = z.object({
  skill: z.string().min(1),
});

export const SearchSkillsSchema = z.object({
  query: z.string().min(1),
});

export const ResearchSchema = z.object({
  topic: z.string().min(1),
  domain: z.string().optional(),
});

export const ComparePromptsSchema = z.object({
  promptA: z.string().min(1),
  promptB: z.string().min(1),
});

export const RunSkillSchema = z.object({
  skill: z.unknown(),
  input: z.unknown().optional(),
});

export type PromptInput = z.infer<typeof PromptInputSchema>;
export type TemplateInput = z.infer<typeof TemplateInputSchema>;
export type SkillInput = z.infer<typeof SkillInputSchema>;
export type EvaluationInput = z.infer<typeof EvaluationInputSchema>;
export type SettingsInput = z.infer<typeof SettingsInputSchema>;
