import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import FormPost from "@/components/console/form-post"
import { useId, useState } from 'react';

import {
  SquarePlus,
} from "lucide-react"


interface DialogPostProps {
  refreshUp: () => void; // refreshUpis a function 
  blueprint: any; // Replace 'any' with a more specific type if possible
  path: string;
  method: string;
  title: string;
  instructions: string;
  buttontext?:string;
}

export default function DialogPost({ refreshUp, blueprint, path, method, title, instructions, buttontext }: DialogPostProps) {

  const [open, setOpen] = useState(false);
  const formId = useId().replace(/:/g, "");
  console.log('Blueprint @ DialogPost')
  console.log(blueprint);

  // Function to update the state
  const refreshAction = () => {
    setOpen(false);
    refreshUp()

  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex flex-row gap-3">
          <SquarePlus />
          {buttontext}
        </div>    
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-14 text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {instructions}
              </DialogDescription>
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
          <FormPost
              refreshUp={refreshAction}
              blueprint={blueprint}
              path={path}
              method={method}
              formId={formId}
              hideSubmitButton
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
