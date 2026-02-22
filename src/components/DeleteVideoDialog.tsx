"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Trash2 as Trash2Icon, Cancel02Icon as XIcon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"

interface DeleteVideoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoTitle: string
  onDeleteFromFile: () => void
  onRemoveFromList: () => void
}

export const DeleteVideoDialog = ({
  open,
  onOpenChange,
  videoTitle,
  onDeleteFromFile,
  onRemoveFromList,
}: DeleteVideoDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-1">
              <HugeiconsIcon icon={Trash2Icon} size={24} className="text-destructive" />
            </div>
            <div className="flex-1 space-y-2">
              <DialogTitle className="text-left text-lg font-semibold">
                Delete video
              </DialogTitle>
              <DialogDescription className="text-left text-sm leading-relaxed">
                What would you like to do with "<span className="font-medium text-foreground">{videoTitle}</span>"?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="px-6 py-4 space-y-3">
          <Button
            variant="destructive"
            onClick={() => {
              onDeleteFromFile()
              onOpenChange(false)
            }}
            className="w-full justify-start h-12 px-4 group hover:bg-destructive/90"
          >
            <HugeiconsIcon icon={Trash2Icon} size={18} className="mr-3" />
            <div className="flex-1 text-left">
              <div className="font-medium">Delete from folder</div>
              <div className="text-xs opacity-70 mt-0.5">Permanently deletes the file from your device</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => {
              onRemoveFromList()
              onOpenChange(false)
            }}
            className="w-full justify-start h-12 px-4 group hover:bg-secondary/50 border-border"
          >
            <HugeiconsIcon icon={XIcon} size={18} className="mr-3 text-muted-foreground" />
            <div className="flex-1 text-left">
              <div className="font-medium">Remove from list</div>
              <div className="text-xs text-muted-foreground mt-0.5">Keeps the file, removes from app only</div>
            </div>
          </Button>
        </div>
        
        <div className="px-6 py-4 pt-0 flex justify-end">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="h-10 px-6 hover:bg-secondary/50"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
