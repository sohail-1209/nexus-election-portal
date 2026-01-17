
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
import { Settings, LogOut, LockKeyhole, Bell, CalendarDays, Trash2, PinOff, Share2, Edit } from "lucide-react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { auth } from "@/lib/firebaseClient";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { useSettingsStore } from "@/stores/settingsStore";
import EnableDeletionDialog from "./admin/EnableDeletionDialog";
import MultiPinDialog from "./admin/MultiPinDialog";
import ClearTermDialog from "./admin/ClearTermDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ShareableLinkDisplay from "./admin/ShareableLinkDisplay";
import EditTermDialog from "./admin/EditTermDialog";


export default function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const { hasNotifications, setHasNotifications, triggerNotification } = useNotificationStore();
  const { enableDeletion, multiPin } = useSettingsStore();

  const isAdminPage = pathname.startsWith('/admin');

  useEffect(() => {
    setMounted(true);
     if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
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
  
  const handleTermCleared = () => {
    // This can be used to refresh the dashboard view if needed.
    // For now, a page reload or re-fetch on the dashboard itself handles it.
  }
  
  const dashboardLink = `${baseUrl}/?view=public`;


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
            <DropdownMenuContent align="end" className="w-60">
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
              <DropdownMenuLabel>General Settings</DropdownMenuLabel>
                <Dialog>
                    <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                           <div className="flex w-full items-center justify-between">
                               <span className="flex items-center gap-2">
                                 <Share2 className="h-4 w-4" />
                                 Share Dashboard
                               </span>
                           </div>
                        </DropdownMenuItem>
                    </DialogTrigger>
                     <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Share Leadership Dashboard</DialogTitle>
                            <DialogDescription>
                            This special link will show the public leadership view, even if you are logged in as an admin. Share it with anyone to let them see the current structure.
                            </DialogDescription>
                        </DialogHeader>
                        <ShareableLinkDisplay voterLink={dashboardLink} />
                    </DialogContent>
                </Dialog>
               <MultiPinDialog>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                     <div className="flex w-full items-center justify-between">
                       <span className="flex items-center gap-2">
                         <PinOff className="h-4 w-4" />
                         Multi-Pin Rooms
                       </span>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-muted-foreground">{multiPin ? 'On' : 'Off'}</span>
                           <div className={`h-2 w-2 rounded-full ${multiPin ? 'bg-green-500' : 'bg-muted'}`} />
                        </div>
                     </div>
                  </DropdownMenuItem>
              </MultiPinDialog>
               <EditTermDialog onTermUpdated={handleTermCleared}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                       <div className="flex w-full items-center justify-between">
                           <span className="flex items-center gap-2">
                             <Edit className="h-4 w-4" />
                             Edit Leadership
                           </span>
                       </div>
                    </DropdownMenuItem>
                </EditTermDialog>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Destructive Actions</DropdownMenuLabel>
                <EnableDeletionDialog>
                   <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                     <div className="flex w-full items-center justify-between">
                       <span className="flex items-center gap-2">
                         <Trash2 className="h-4 w-4" />
                         Enable Deletion
                       </span>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-muted-foreground">{enableDeletion ? 'On' : 'Off'}</span>
                           <div className={`h-2 w-2 rounded-full ${enableDeletion ? 'bg-destructive' : 'bg-muted'}`} />
                        </div>
                     </div>
                   </DropdownMenuItem>
                </EnableDeletionDialog>
                <ClearTermDialog onTermCleared={handleTermCleared}>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer text-destructive focus:text-destructive">
                       <span className="flex items-center gap-2">
                         <Trash2 className="h-4 w-4" />
                         Clear Current Term
                       </span>
                   </DropdownMenuItem>
                </ClearTermDialog>
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
