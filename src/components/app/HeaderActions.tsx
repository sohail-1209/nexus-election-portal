
"use client";

import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, LockKeyhole, Bell, CalendarDays, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { auth } from "@/lib/firebaseClient";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { useSettingsStore } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const { hasNotifications, setHasNotifications, triggerNotification } = useNotificationStore();
  const { enableDeletion, toggleDeletion } = useSettingsStore();

  const isAdminPage = pathname.startsWith('/admin');

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Check for calendar notifications on mount
    try {
      const savedNotesRaw = localStorage.getItem("calendarNotes");
      if (savedNotesRaw) {
        const savedNotes = JSON.parse(savedNotesRaw);
        const todayString = format(new Date(), "yyyy-MM-dd");
        if (savedNotes[todayString] && savedNotes[todayString].notify) {
          triggerNotification();
        }
      }
    } catch (error) {
      console.error("Could not check calendar notifications:", error);
    }
    
    return () => unsubscribe();
  }, [triggerNotification]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/admin/login');
    } catch (error) {
        console.error("Logout Failed", error);
    }
  };

  const handleNotificationClick = () => {
    setHasNotifications(false);
    router.push('/admin/calendar');
  };

  return (
    <>
      <ThemeToggle />
      {mounted && isAdminPage && user && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" onClick={handleNotificationClick}>
                    {hasNotifications && <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-destructive animate-ping" />}
                    {hasNotifications && <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-destructive" />}
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleNotificationClick} className="cursor-pointer">
                    {hasNotifications ? "You have a reminder for today!" : "No new notifications."}
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                  <Link href="/admin/calendar">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      <span>Calendar</span>
                  </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                  <Link href="/admin/change-password">
                      <LockKeyhole className="mr-2 h-4 w-4" />
                      <span>Change Password</span>
                  </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
               <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <div className="flex w-full items-center justify-between">
                    <Label htmlFor="delete-switch" className="flex items-center gap-2 font-normal cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                      Enable Deletion
                    </Label>
                    <Switch
                      id="delete-switch"
                      checked={enableDeletion}
                      onCheckedChange={toggleDeletion}
                    />
                  </div>
                </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </>
  );
}
