import { useState } from "react";
import { PromptCreator } from "./modules/PromptCreator";
import { PromptEvaluator } from "./modules/PromptEvaluator";
import { PromptOptimizer } from "./modules/PromptOptimizer";
import { PromptCompare } from "./modules/PromptCompare";
import { PromptLibrary } from "./modules/PromptLibrary";
import { PromptTemplates } from "./modules/PromptTemplates";
import { PromptResearch } from "./modules/PromptResearch";
import { SkillSearch } from "./modules/SkillSearch";
import { SkillResearch } from "./modules/SkillResearch";
import { SkillCreator } from "./modules/SkillCreator";
import { SkillOptimizer } from "./modules/SkillOptimizer";
import { SkillEvaluator } from "./modules/SkillEvaluator";
import { SkillLibrary } from "./modules/SkillLibrary";
import { SkillLab } from "./modules/SkillLab";

type Module = {
  id: string;
  title: string;
  description: string;
};

const promptModules: Module[] = [
  { id: "creator", title: "Creator", description: "Generate prompts from a goal" },
  { id: "evaluator", title: "Evaluator", description: "Score prompt quality" },
  { id: "optimizer", title: "Optimizer", description: "Improve prompts" },
  { id: "compare", title: "Compare", description: "Side-by-side comparison" },
  { id: "library", title: "Library", description: "Save and manage prompts" },
  { id: "template", title: "Templates", description: "Reusable templates" },
  { id: "research", title: "Research", description: "Prompt engineering research" },
];

const skillModules: Module[] = [
  { id: "search", title: "Search", description: "Discover skills" },
  { id: "research", title: "Research", description: "Skill domain research" },
  { id: "creator", title: "Creator", description: "Create skill definitions" },
  { id: "optimizer", title: "Optimizer", description: "Improve skills" },
  { id: "evaluator", title: "Evaluator", description: "Score skill quality" },
  { id: "library", title: "Library", description: "Manage skills" },
  { id: "lab", title: "Lab", description: "Experiment and test" },
];

function renderPromptModule(active: string) {
  switch (active) {
    case "creator":
      return <PromptCreator />;
    case "evaluator":
      return <PromptEvaluator />;
    case "optimizer":
      return <PromptOptimizer />;
    case "compare":
      return <PromptCompare />;
    case "library":
      return <PromptLibrary />;
    case "template":
      return <PromptTemplates />;
    case "research":
      return <PromptResearch />;
    default:
      return null;
  }
}

function renderSkillModule(active: string) {
  switch (active) {
    case "search":
      return <SkillSearch />;
    case "research":
      return <SkillResearch />;
    case "creator":
      return <SkillCreator />;
    case "optimizer":
      return <SkillOptimizer />;
    case "evaluator":
      return <SkillEvaluator />;
    case "library":
      return <SkillLibrary />;
    case "lab":
      return <SkillLab />;
    default:
      return null;
  }
}

export default function App() {
  const [engine, setEngine] = useState<"prompt" | "skill">("prompt");
  const [active, setActive] = useState<string>("creator");
  const modules = engine === "prompt" ? promptModules : skillModules;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">Prompt &amp; Skills Engine</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEngine("prompt");
                setActive("creator");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                engine === "prompt" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Prompt Engine
            </button>
            <button
              onClick={() => {
                setEngine("skill");
                setActive("creator");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                engine === "skill" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Skills Engine
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm transition ${
                active === m.id
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold">{m.title}</div>
              <div className="text-xs opacity-80">{m.description}</div>
            </button>
          ))}
        </aside>
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            {modules.find((m) => m.id === active)?.title}
          </h2>
          <p className="mt-2 text-slate-600">
            {engine === "prompt" ? "Prompt Engine" : "Skills Engine"} module: {active}
          </p>
          <div className="mt-6">
            {engine === "prompt"
              ? renderPromptModule(active)
              : renderSkillModule(active)}
          </div>
        </section>
      </main>
    </div>
  );
}
