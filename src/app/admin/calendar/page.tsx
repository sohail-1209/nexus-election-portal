
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Save, Bell, Trash2, BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/stores/notificationStore";

type Note = {
  text: string;
  notify: boolean;
};

type NotesStore = {
  [date: string]: Note;
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState<NotesStore>({});
  const [notify, setNotify] = useState(false);
  const { toast } = useToast();
  const { triggerNotification } = useNotificationStore();

  const selectedDateString = date ? format(date, "yyyy-MM-dd") : "";

  // Load notes from local storage on component mount
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
  
  // Update form when a new date is selected
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
  
  const sortedSavedNotes = Object.entries(notes)
    .filter(([_, note]) => note.text)
    .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime());


  return (
    <div className="space-y-8">
       <div className="text-center">
        <h1 className="text-3xl font-bold font-headline flex items-center justify-center gap-3">
          <CalendarDays className="h-8 w-8" />
          Calendar & Notes
        </h1>
        <p className="text-muted-foreground mt-2">Select a date to view or add notes and reminders.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
            <Card className="shadow-xl">
                 <CardContent className="p-0 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-md"
                        classNames={{
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground",
                            today: "bg-accent/50 text-accent-foreground",
                            caption: "flex justify-center pt-1 relative items-center text-lg",
                            root: "w-full"
                        }}
                    />
                </CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-2">
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
                <CardTitle>Saved Notes</CardTitle>
                <CardDescription>All your upcoming notes and reminders at a glance.</CardDescription>
            </CardHeader>
            <CardContent>
                {sortedSavedNotes.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {sortedSavedNotes.map(([dateString, note]) => (
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
                    <p className="text-muted-foreground text-center py-8">No notes saved yet.</p>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
