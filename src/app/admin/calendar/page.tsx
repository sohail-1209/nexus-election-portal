
"use client";

import { useState, useEffect } from "react";
import { format, getMonth, getYear } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Bell, Trash2, BellRing, ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/stores/notificationStore";
import Link from 'next/link';

type Note = {
  text: string;
  notify: boolean;
};

type NotesStore = {
  [date: string]: Note;
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [notes, setNotes] = useState<NotesStore>({});
  const [notify, setNotify] = useState(false);
  const { toast } = useToast();
  const { triggerNotification } = useNotificationStore();

  const selectedDateString = date ? format(date, "yyyy-MM-dd") : "";

  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem("calendarNotes");
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }
    } catch (error) {
      console.error("Could not load notes from local storage:", error);
    }
  }, []);
  
  useEffect(() => {
    if (date) {
        const selectedNote = notes[selectedDateString];
        setNotify(selectedNote?.notify || false);
    }
  }, [date, notes, selectedDateString]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!date) return;
    const existingNote = notes[selectedDateString] || { text: "", notify: false };
    setNotes({
      ...notes,
      [selectedDateString]: { ...existingNote, text: e.target.value },
    });
  };
  
  const handleSaveNote = () => {
    if (!date) return;
    const updatedNote = { text: notes[selectedDateString]?.text || "", notify: notify };
    const updatedNotes = { ...notes, [selectedDateString]: updatedNote };

    setNotes(updatedNotes);
    
    try {
        localStorage.setItem("calendarNotes", JSON.stringify(updatedNotes));
        toast({
            title: "Note Saved",
            description: `Your note for ${format(date, "PPP")} has been saved.`,
        });
        if(notify) {
             toast({
                title: "Notification Set",
                description: `You will be notified on ${format(date, "PPP")}.`,
                variant: "default"
            });
        }
    } catch (error) {
         toast({
            variant: "destructive",
            title: "Save Failed",
            description: `Could not save notes to local storage.`,
        });
    }
  };

  const handleDeleteNote = (dateString: string) => {
    const newNotes = { ...notes };
    delete newNotes[dateString];
    setNotes(newNotes);
    try {
      localStorage.setItem("calendarNotes", JSON.stringify(newNotes));
      toast({
        title: "Note Deleted",
        description: `Your note for ${format(new Date(dateString), "PPP")} has been deleted.`,
      });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Delete Failed",
            description: `Could not delete note from local storage.`,
        });
    }
  };
  
  const monthlyNotes = Object.entries(notes)
    .filter(([dateString, note]) => {
        const noteDate = new Date(dateString);
        return note.text && getYear(noteDate) === getYear(currentMonth) && getMonth(noteDate) === getMonth(currentMonth);
    })
    .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime());

  return (
    <div className="space-y-8">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:col-span-1">
            <Card className="shadow-xl">
                 <CardContent className="p-0 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        className="rounded-md"
                        classNames={{
                            root: "w-full p-4",
                            months: "w-full",
                            month: "w-full space-y-4 min-h-[350px]",
                            caption: "flex justify-center pt-2 relative items-center text-xl font-medium",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex justify-between",
                            head_cell: "text-muted-foreground rounded-md w-12 font-normal text-base",
                            row: "flex w-full mt-2 justify-between",
                            cell: "h-14 w-14 text-center text-lg p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                            day: "h-14 w-14 p-0 font-normal aria-selected:opacity-100",
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground",
                            day_today: "bg-accent text-accent-foreground rounded-full",
                        }}
                    />
                </CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-xl sticky top-24">
            <CardHeader>
              <CardTitle>Notes & Reminders</CardTitle>
              <CardDescription>
                {date ? `Editing for: ${format(date, "PPP")}` : "Select a date to start."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Write your notes for the selected day here..."
                rows={6}
                value={date ? notes[selectedDateString]?.text || "" : ""}
                onChange={handleNoteChange}
                disabled={!date}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Switch id="notify-switch" checked={notify} onCheckedChange={setNotify} disabled={!date} />
                    <Label htmlFor="notify-switch" className="flex items-center gap-1">
                        <Bell className="h-4 w-4" /> Notify me
                    </Label>
                </div>
                <Button onClick={handleSaveNote} disabled={!date || !notes[selectedDateString]?.text}>
                  <Save className="mr-2 h-4 w-4" /> Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
       <Card className="shadow-xl">
            <CardHeader>
                <CardTitle>Saved Notes for {format(currentMonth, "MMMM yyyy")}</CardTitle>
                <CardDescription>All your notes and reminders for the selected month.</CardDescription>
            </CardHeader>
            <CardContent>
                {monthlyNotes.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {monthlyNotes.map(([dateString, note]) => (
                            <div key={dateString} className="flex justify-between items-start p-3 rounded-lg border bg-muted/30">
                                <div>
                                    <p className="font-semibold">{format(new Date(dateString), "PPP")}</p>
                                    <p className="text-muted-foreground text-sm mt-1">{note.text}</p>
                                </div>
                                <div className="flex items-center gap-2 pl-4">
                                     {note.notify && <BellRing className="h-5 w-5 text-primary" />}
                                     <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(dateString)}>
                                         <Trash2 className="h-4 w-4 text-destructive" />
                                     </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">No notes saved for {format(currentMonth, "MMMM")}.</p>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
