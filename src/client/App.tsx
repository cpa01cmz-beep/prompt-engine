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
import { cn } from "./components/utils";

type Engine = "prompt" | "skill";

interface Module {
  id: string;
  title: string;
  description: string;
}

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

function renderPromptModule(active: string): JSX.Element | null {
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

function renderSkillModule(active: string): JSX.Element | null {
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

export default function App(): JSX.Element {
  const [engine, setEngine] = useState<Engine>("prompt");
  const [active, setActive] = useState<string>("creator");
  const modules = engine === "prompt" ? promptModules : skillModules;
  const current = modules.find((m) => m.id === active) ?? modules[0];

  const switchEngine = (next: Engine): void => {
    setEngine(next);
    setActive(next === "prompt" ? "creator" : "search");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/40 to-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3l1.9 4.6L18.5 9.5 14.4 12.9 15.6 17.8 12 15.1 8.4 17.8 9.6 12.9 5.5 9.5 10.1 7.6 12 3z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">Prompt &amp; Skills Engine</h1>
          </div>
          <div role="group" aria-label="Engines" className="inline-flex rounded-full bg-slate-100 p-1">
            <button
              type="button"
              aria-pressed={engine === "prompt"}
              aria-controls="engine-panel"
              onClick={() => switchEngine("prompt")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                engine === "prompt"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Prompt Engine
            </button>
            <button
              type="button"
              aria-pressed={engine === "skill"}
              aria-controls="engine-panel"
              onClick={() => switchEngine("skill")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                engine === "skill"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Skills Engine
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <aside
            className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm shadow-slate-200/60 lg:sticky lg:top-20 lg:self-start"
            aria-label="Modules"
          >
            <nav aria-label="Engine modules">
              <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
                {modules.map((m) => {
                  const isActive = m.id === current.id;
                  return (
                    <li key={m.id} className="shrink-0 lg:shrink">
                      <button
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => setActive(m.id)}
                        className={cn(
                          "w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 lg:whitespace-normal",
                          isActive
                            ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                            : "text-slate-700 hover:bg-slate-100",
                        )}
                      >
                        <span className="block font-semibold">{m.title}</span>
                      </button>
                      <span
                        className={cn(
                          "mt-0.5 hidden px-3 pb-1 text-xs lg:block",
                          isActive ? "text-indigo-600/80" : "text-slate-500",
                        )}
                      >
                        {m.description}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <section id="engine-panel" className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/60 sm:p-8">
            <header className="mb-6 border-b border-slate-200/70 pb-5">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{current.title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {engine === "prompt" ? "Prompt Engine" : "Skills Engine"} module: {current.id}
              </p>
            </header>
            <div className="space-y-6">
              {engine === "prompt" ? renderPromptModule(current.id) : renderSkillModule(current.id)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
