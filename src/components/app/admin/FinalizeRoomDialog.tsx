
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
import { ShieldAlert, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { finalizeAndAnonymizeRoom } from "@/lib/electionRoomService";

interface FinalizeRoomDialogProps {
  roomId: string;
  onFinalized: () => void;
}

export default function FinalizeRoomDialog({ roomId, onFinalized }: FinalizeRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleFinalize = async () => {
    setIsLoading(true);
    const result = await finalizeAndAnonymizeRoom(roomId, password);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: "Results Finalized",
        description: result.message,
      });
      onFinalized(); // Callback to refresh data on the parent page
      setOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Finalization Failed",
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
          <ShieldAlert className="mr-2 h-4 w-4" />
          Finalize &amp; Anonymize
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalize &amp; Anonymize Results</DialogTitle>
          <DialogDescription>
            This is a permanent, irreversible action.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              Finalizing will permanently delete all individual votes, reviews, and participant entries from the database. The results will be stored as a static summary. This action cannot be undone.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="admin-password">
              Enter your password to confirm
            </Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            type="button"
            variant="destructive"
            onClick={handleFinalize}
            disabled={isLoading || password.length < 6}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            I understand, Finalize Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
