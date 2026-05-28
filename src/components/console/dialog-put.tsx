import { Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import FormPut from "@/components/console/form-put"
import { useId, useState } from "react"

interface DialogPutProps {
  selectedKey: string
  selectedValue: unknown
  refreshUp: () => void
  blueprint?: { fields?: Array<Record<string, unknown>> }
  path: string
  method: string
  title: string
  instructions: string
}

function metaForField(
  blueprint: DialogPutProps["blueprint"],
  selectedKey: string,
) {
  const field = blueprint?.fields?.find((f) => f.name === selectedKey) as
    | Record<string, unknown>
    | undefined
  const label = typeof field?.label === "string" ? field.label : null
  const typeStr = typeof field?.type === "string" ? field.type : null
  const cardinalityStr =
    typeof field?.cardinality === "string" ? field.cardinality : null
  return { label, typeStr, cardinalityStr }
}

export default function DialogPut({
  selectedKey,
  selectedValue,
  refreshUp,
  blueprint,
  path,
  method,
  title,
  instructions,
}: DialogPutProps) {
  const [open, setOpen] = useState(false)
  const formId = useId().replace(/:/g, "")
  const { label: blueprintLabel, typeStr, cardinalityStr } = metaForField(
    blueprint,
    selectedKey,
  )
  const headerTitle = blueprintLabel || title
  const subtitleParts = [
    typeStr
      ? `Type: ${typeStr}${cardinalityStr ? ` (${cardinalityStr})` : ""}`
      : null,
    instructions?.trim() || null,
  ].filter(Boolean)

  const refreshAction = () => {
    setOpen(false)
    refreshUp()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Edit this field"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="sticky top-0 z-20 shrink-0 space-y-0 border-b bg-background px-4 py-3 pr-14 text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-base font-semibold leading-snug">
                {headerTitle}
              </DialogTitle>
              {subtitleParts.length > 0 && (
                <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  {subtitleParts.join(" · ")}
                </DialogDescription>
              )}
            </div>
            <Button
              type="submit"
              form={formId}
              size="sm"
              className="w-full shrink-0 sm:mt-0 sm:w-auto"
            >
              Save
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <FormPut
            selectedKey={selectedKey}
            selectedValue={selectedValue}
            refreshUp={refreshAction}
            blueprint={blueprint}
            path={path}
            method={method}
            formId={formId}
            hideChrome
            hideSubmitButton
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
