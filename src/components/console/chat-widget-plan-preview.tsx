/**
 * Plan Preview Component
 * 
 * Displays a preview of a plan with steps showing title, action, and inputs.
 * 
 * DEPENDENCIES REQUIRED:
 * - react
 * - tailwindcss (for styling)
 * 
 * CSS VARIABLES USED (optional - will fallback to defaults):
 * - text-muted-foreground (falls back to gray)
 * - bg-card (falls back to white/transparent)
 * - text-card-foreground (falls back to black)
 * - border (falls back to gray border)
 */

interface PlanStep {
  step_id: string
  title: string
  action: string
  inputs: Record<string, any>
  depends_on?: string[]
  next_step?: string | null
  enter_guard?: string
  success_criteria?: string
}

interface Plan {
  id?: string
  meta?: {
    strategy?: string
  }
  steps: PlanStep[]
}

interface PlanPreviewProps {
  key_id?: string | number
  item: {
    _out: {
      content?: string | Array<{ plan?: Plan | Plan[] }> | { plan?: Plan | Plan[] }
    }
  }
}

type PlanEnvelope = { plan?: Plan | Plan[] }

export default function ChatWidgetPlanPreview({ item }: PlanPreviewProps) {
  // Content is handler-defined; may be string (JSON), array, or dict.
  // Handlers (generate_plan, modify_plan) return { plan, intent } or [{ plan }].
  let content: PlanEnvelope | PlanEnvelope[] | string | undefined | null = item?._out?.content
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content) as PlanEnvelope | PlanEnvelope[]
    } catch {
      content = null
    }
  }
  const first: PlanEnvelope | null = Array.isArray(content)
    ? content[0] ?? null
    : (content && typeof content === 'object' ? content : null)
  const planData = first?.plan ?? null
  const actualPlan = Array.isArray(planData) ? planData[0] : planData

  if (!actualPlan) {
    return null
  }

  if (!actualPlan.steps || actualPlan.steps.length === 0) {
    return (
      <div className="w-[80%] mx-auto p-4 rounded-lg border bg-card">
        <div className="mb-3 pb-2 border-b">
          <h3 className="text-xs font-semibold text-card-foreground">Plan Preview</h3>
          {actualPlan.id && (
            <p className="text-xs text-muted-foreground mt-1">Plan id: {actualPlan.id}</p>
          )}
          {actualPlan.meta?.strategy && (
            <p className="text-xs text-muted-foreground">Strategy: {actualPlan.meta.strategy}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">No steps in this plan.</p>
      </div>
    )
  }

  return (
    <div className="w-[80%] mx-auto p-4 rounded-lg border bg-card">
      {/* Plan Header */}
      {actualPlan.id && (
        <div className="mb-3 pb-2 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-card-foreground">Plan Preview</h3>
          </div>
        </div>
      )}

      {/* Plan Steps - Compact Checklist */}
      <div className="space-y-1.5">
        {actualPlan.steps.map((step: PlanStep, index: number) => {
          const inputsStr = step.inputs && Object.keys(step.inputs).length > 0
            ? Object.entries(step.inputs)
                .map(([key, value]) => {
                  const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
                  return `${key.replace(/_/g, ' ')}: ${val}`
                })
                .join(', ')
            : ''

          return (
            <div
              key={step.step_id || index}
              className="flex items-start gap-2 text-xs py-1"
            >
              <span className="text-muted-foreground mt-0.5">•</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-card-foreground">{step.title}</span>
                  <span className="text-muted-foreground">({step.action})</span>
                  {inputsStr && (
                    <span className="text-muted-foreground text-[10px]">{inputsStr}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
