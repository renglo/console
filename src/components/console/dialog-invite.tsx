import {
    UserPlus,
  } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import FormInvite from "@/components/console/form-invite"

import { useState } from 'react';


interface DialogInviteProps {
    team_id: string;          // Assuming selectedKey is a string; change type as needed
    portfolio_id: string;           // Replace 'any' with a more specific type if possible
    refreshUp: () => void;      // Assuming refreshUp is a function
    path: string;
    method: string;
    title: string;
    instructions: string;
}

export default function DialogInvite({ team_id, portfolio_id, refreshUp, path, method, title, instructions }: DialogInviteProps) {


  const [open, setOpen] = useState(false);

  // Function to update the state
  const refreshAction = () => {
      refreshUp();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <UserPlus className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {instructions}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] w-full rounded-md border p-6" >
          <FormInvite  
                team_id={team_id} 
                portfolio_id={portfolio_id}
                refreshUp={refreshAction}
                path={path}
                method={method}
          />
        </ScrollArea>
        <DialogFooter>     
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
