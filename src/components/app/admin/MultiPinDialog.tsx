
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
import { useSettingsStore } from "@/stores/settingsStore";
import { auth } from "@/lib/firebaseClient";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";


export default function MultiPinDialog({ children }: { children: React.ReactNode }) {
  const { multiPin, toggleMultiPin } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You are not logged in." });
      return;
    }

    setIsLoading(true);
    const credential = EmailAuthProvider.credential(user.email, password);

    try {
      await reauthenticateWithCredential(user, credential);
      toggleMultiPin();
      toast({
        title: "Setting Updated",
        description: `Multi-pinning has been ${!multiPin ? "enabled" : "disabled"}.`,
      });
      setOpen(false);
    } catch (error) {
      console.error("Password verification failed", error);
      toast({
        variant: "destructive",
        title: "Password Incorrect",
        description: "The password you entered is incorrect. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setPassword("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Your Identity</DialogTitle>
          <DialogDescription>
            To change this sensitive setting, please enter your password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Alert variant={multiPin ? "default" : "destructive"}>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>
              You are about to {multiPin ? "disable" : "enable"} multi-pinning.
            </AlertTitle>
            <AlertDescription>
                {multiPin
                ? "Disabling this will only allow rooms to be pinned once."
                : "Enabling this will allow rooms to be pinned multiple times."}
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="admin-password-multipin-toggle">
              Enter your password to confirm
            </Label>
            <div className="relative">
              <Input
                id="admin-password-multipin-toggle"
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
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || password.length < 6}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm &amp; Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
