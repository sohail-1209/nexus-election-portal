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
import { Settings, LogOut, LockKeyhole, Bell, CalendarDays } from "lucide-react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { auth } from "@/lib/firebaseClient";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useNotificationStore } from "@/stores/notificationStore";

export default function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const { hasNotifications, setHasNotifications } = useNotificationStore();

  const isAdminPage = pathname.startsWith('/admin');

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/admin/login');
    } catch (error) {
        console.error("Logout Failed", error);
    }
  };

  const handleNotificationClick = () => {
    // Here you would typically open a notification panel/page
    // For now, we'll just clear the notification state
    setHasNotifications(false);
    // You might want to router.push('/admin/notifications') or similar
  };

  return (
    <>
      <ThemeToggle />
      {mounted && isAdminPage && user && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    {hasNotifications && <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-destructive" />}
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setHasNotifications(false)}>
                    {hasNotifications ? "You have new updates." : "No new notifications."}
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
            <DropdownMenuContent align="end">
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
