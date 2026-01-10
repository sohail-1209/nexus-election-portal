
"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { archiveRoom } from "@/lib/electionRoomService";

interface DeleteRoomDialogProps {
  roomId: string;
  roomTitle: string;
  onRoomDeleted: () => void;
}

export default function DeleteRoomDialog({ roomId, roomTitle, onRoomDeleted }: DeleteRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleArchive = async () => {
    setIsLoading(true);
    const result = await archiveRoom(roomId, password);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: "Room Archived",
        description: `"${roomTitle}" has been moved to the archive.`,
      });
      onRoomDeleted();
      setOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Archive Failed",
        description: result.message,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            setPassword("");
            setIsLoading(false);
        }
    }}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Room
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will archive the room, hiding it from the dashboard. You can restore it later from the settings menu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Password Confirmation Required</AlertTitle>
            <AlertDescription>
                To archive the room <span className="font-bold">"{roomTitle}"</span>, please enter your password.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="admin-password-delete">
              Enter your password to confirm
            </Label>
            <div className="relative">
              <Input
                id="admin-password-delete"
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
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleArchive}
            disabled={isLoading || password.length < 6}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, Archive Room
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
