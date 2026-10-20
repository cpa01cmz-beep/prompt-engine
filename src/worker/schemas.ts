import { z } from "zod";

// Maximum serialized text any client-supplied field may carry. This bounds D1
// writes, AI prompt construction, and Worker memory per request.
const MAX_TEXT = 20_000;
const MAX_TITLE = 300;
const MAX_SEARCH = 500;
const MAX_ARRAY_ITEMS = 50;
const MAX_JSON_SERIALIZED = 32 * 1024;

function serializedJsonSize(value: unknown): number {
  if (value === undefined) return Infinity;
  try {
    return JSON.stringify(value).length;
  } catch {
    return Infinity;
  }
}

const BoundedText = z.string().max(MAX_TEXT);
const BoundedShortText = z.string().max(MAX_TITLE);
const BoundedSearchText = z.string().max(MAX_SEARCH);
const BoundedStrings = z.array(z.string().max(MAX_TEXT)).max(MAX_ARRAY_ITEMS);

export const PromptInputSchema = z.object({
  title: BoundedShortText.min(1),
  content: BoundedText.min(1),
  role: BoundedShortText.optional(),
  variables: BoundedStrings.optional(),
  constraints: BoundedText.optional(),
  examples: BoundedText.optional(),
  tags: z.array(BoundedShortText).max(MAX_ARRAY_ITEMS).optional(),
});

export const PromptUpdateSchema = PromptInputSchema.partial();

export const TemplateInputSchema = z.object({
  name: BoundedShortText.min(1),
  body: BoundedText.min(1),
  variables: BoundedStrings.optional(),
});

export const TemplateUpdateSchema = TemplateInputSchema.partial();

export const SkillInputSchema = z.object({
  name: BoundedShortText.min(1),
  description: BoundedText.optional(),
  instructions: BoundedText.optional(),
  tools: BoundedStrings.optional(),
  examples: BoundedStrings.optional(),
  tags: z.array(BoundedShortText).max(MAX_ARRAY_ITEMS).optional(),
});

export const SkillUpdateSchema = SkillInputSchema.partial();

export const EvaluationInputSchema = z.object({
  targetType: z.enum(["prompt", "skill"]),
  targetId: BoundedShortText.min(1),
  score: z.number().min(0).max(100).nullable().optional(),
  feedback: z.unknown().refine((v) => serializedJsonSize(v) <= MAX_JSON_SERIALIZED, {
    message: "feedback is too large",
  }).optional(),
  model: BoundedShortText.optional(),
});

export const SettingsInputSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export const SettingsValueSchema = z.object({
  // `undefined` is not a representable JSON value, so a missing/undefined
  // value is not a valid setting payload (it would otherwise make
  // JSON.stringify return `undefined` and crash the size check).
  value: z.unknown()
    .refine((v) => v !== undefined, { message: "value is required" })
    .refine((v) => serializedJsonSize(v) <= MAX_JSON_SERIALIZED, {
      message: "value is too large",
    }),
});

// AI request bodies
export const AiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: BoundedText.min(1),
});

export const ChatRequestSchema = z.object({
  messages: z.array(AiMessageSchema).min(1).max(40),
});

export const GeneratePromptSchema = z.object({
  goal: BoundedText.min(1),
  role: BoundedText.optional(),
  variables: z.array(BoundedText.min(1)).max(50).optional(),
  constraints: BoundedText.optional(),
  examples: BoundedText.optional(),
});

export const EvaluatePromptSchema = z.object({
  prompt: BoundedText.min(1),
});

export const OptimizePromptSchema = z.object({
  prompt: BoundedText.min(1),
});

export const GenerateSkillSchema = z.object({
  goal: BoundedText.min(1),
});

export const EvaluateSkillSchema = z.object({
  skill: BoundedText.min(1),
});

export const OptimizeSkillSchema = z.object({
  skill: BoundedText.min(1),
});

export const SearchSkillsSchema = z.object({
  query: BoundedSearchText.min(1),
});

export const ResearchSchema = z.object({
  topic: BoundedText.min(1),
  domain: BoundedShortText.optional(),
});

export const ComparePromptsSchema = z.object({
  promptA: BoundedText.min(1),
  promptB: BoundedText.min(1),
});

export const RunSkillSchema = z.object({
  skill: z.unknown().refine((v) => serializedJsonSize(v) <= MAX_JSON_SERIALIZED, {
    message: "skill is too large",
  }),
  input: z.unknown().refine((v) => serializedJsonSize(v) <= MAX_JSON_SERIALIZED, {
    message: "input is too large",
  }).optional(),
});

// AI-extracted candidate skills (search-skills)
export const SkillCandidateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
});

export const SkillCandidatesSchema = z.array(SkillCandidateSchema);

export type SkillCandidate = z.infer<typeof SkillCandidateSchema>;

// AI model outputs. These bound the *structured* part of AI responses: model
// text is untrusted, so anything that claims to be JSON must validate against
// one of these schemas before a route handler returns it as data.
export const PromptEvaluationSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  feedback: z.array(BoundedShortText).max(MAX_ARRAY_ITEMS).optional(),
});

export const SkillDefinitionSchema = z.object({
  name: BoundedShortText.min(1).optional(),
  description: BoundedShortText.optional(),
  instructions: BoundedText.optional(),
  tools: z.array(BoundedShortText).max(MAX_ARRAY_ITEMS).optional(),
});

export const PromptComparisonSchema = z.object({
  winner: z.enum(["A", "B"]).optional(),
  scores: z.record(z.number()).optional(),
  rationale: BoundedText.optional(),
});
export type PromptInput = z.infer<typeof PromptInputSchema>;
export type TemplateInput = z.infer<typeof TemplateInputSchema>;
export type SkillInput = z.infer<typeof SkillInputSchema>;
export type EvaluationInput = z.infer<typeof EvaluationInputSchema>;
export type SettingsInput = z.infer<typeof SettingsInputSchema>;
