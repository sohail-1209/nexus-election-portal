
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clearLatestTerm } from "@/lib/electionRoomService";


interface ClearTermDialogProps {
    onTermCleared: () => void;
}

export default function ClearTermDialog({ onTermCleared }: ClearTermDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    setIsLoading(true);
    const result = await clearLatestTerm(password);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: "Term Cleared",
        description: "The current leadership term has been cleared from the dashboard.",
      });
      onTermCleared();
      setOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: result.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            setPassword("");
            setIsLoading(false);
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Clear Current Term
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clear Leadership Term</DialogTitle>
          <DialogDescription>
            This action will remove the current term and all its roles from the dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Password Confirmation Required</AlertTitle>
            <AlertDescription>
                To clear the current term, please enter your password. This action cannot be undone.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="admin-password-clear-term">
              Enter your password to confirm
            </Label>
            <div className="relative">
              <Input
                id="admin-password-clear-term"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || password.length < 6}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, Clear Term
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    