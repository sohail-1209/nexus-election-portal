
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { createElectionGroup } from "@/lib/electionRoomService";
import type { ElectionRoom } from "@/lib/types";
import { Layers, Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface GroupRoomsDialogProps {
  allRooms: ElectionRoom[];
  onGroupCreated: () => void;
}

export default function GroupRoomsDialog({ allRooms, onGroupCreated }: GroupRoomsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [step, setStep] = useState(1); // 1 for selection, 2 for password
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleRoomToggle = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
    );
  };

  const handleProceedToPassword = () => {
    if (groupName.trim().length < 3) {
      toast({ variant: "destructive", title: "Invalid Name", description: "Group name must be at least 3 characters." });
      return;
    }
    if (selectedRoomIds.length === 0) {
      toast({ variant: "destructive", title: "No Rooms Selected", description: "Please select at least one room to group." });
      return;
    }
    setStep(2);
  };

  const handleCreateGroup = async () => {
    setIsLoading(true);
    const result = await createElectionGroup(groupName, selectedRoomIds, adminPassword);
    setIsLoading(false);

    if (result.success) {
      toast({ title: "Group Created", description: `Group "${groupName}" was created successfully.` });
      resetState();
      onGroupCreated(); // Re-fetch data on dashboard
    } else {
      toast({ variant: "destructive", title: "Grouping Failed", description: result.message });
      setAdminPassword("");
    }
  };

  const resetState = () => {
    setIsOpen(false);
    setGroupName("");
    setSelectedRoomIds([]);
    setAdminPassword("");
    setShowPassword(false);
    setStep(1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetState(); setIsOpen(open); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Layers className="mr-2 h-5 w-5" /> Group Rooms
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Create a New Room Group</DialogTitle>
              <DialogDescription>
                Group multiple rooms together for better organization on your dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., '2024 Annual Elections'"
                />
              </div>
              <div className="grid gap-2">
                <Label>Select Rooms to Include</Label>
                <ScrollArea className="h-48 w-full rounded-md border p-2">
                  <div className="space-y-2">
                    {allRooms.map((room) => (
                      <div key={room.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                        <Checkbox
                          id={`room-${room.id}`}
                          checked={selectedRoomIds.includes(room.id)}
                          onCheckedChange={() => handleRoomToggle(room.id)}
                        />
                        <label
                          htmlFor={`room-${room.id}`}
                          className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {room.title}
                          <p className="text-xs text-muted-foreground">{room.roomType}</p>
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleProceedToPassword}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Admin Confirmation</DialogTitle>
              <DialogDescription>
                For security, please enter your password to create the group.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Confirm Action</AlertTitle>
                  <AlertDescription>
                    You are about to group {selectedRoomIds.length} room(s) into a new group named "{groupName}". This action cannot be undone.
                  </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter your admin password"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button type="button" onClick={handleCreateGroup} disabled={isLoading || !adminPassword}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Group
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
