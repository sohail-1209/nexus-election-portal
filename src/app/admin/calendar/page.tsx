
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Save } from "lucide-react";

type Note = {
  text: string;
};

type NotesStore = {
  [date: string]: Note;
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState<NotesStore>({});
  const { toast } = useToast();

  const selectedDateString = date ? format(date, "yyyy-MM-dd") : "";

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!date) return;
    setNotes({
      ...notes,
      [selectedDateString]: { text: e.target.value },
    });
  };
  
  const handleSaveNote = () => {
    if (!date) return;
    toast({
        title: "Note Saved",
        description: `Your note for ${format(date, "PPP")} has been saved.`,
    });
    // In a real application, you would save this to a database.
    console.log("Saving note:", selectedDateString, notes[selectedDateString]);
  }

  return (
    <div className="space-y-6">
       <div className="text-center">
        <h1 className="text-3xl font-bold font-headline flex items-center justify-center gap-3">
          <CalendarDays className="h-8 w-8" />
          Calendar & Notes
        </h1>
        <p className="text-muted-foreground mt-2">Select a date to view or add notes and reminders.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <Card className="shadow-xl">
                 <CardContent className="p-2 sm:p-4 md:p-6 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-md"
                        classNames={{
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground",
                            today: "bg-accent/50 text-accent-foreground",
                        }}
                    />
                </CardContent>
            </Card>
        </div>
        
        <div className="lg:col-span-1">
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
                rows={8}
                value={date ? notes[selectedDateString]?.text || "" : ""}
                onChange={handleNoteChange}
                disabled={!date}
              />
              <Button onClick={handleSaveNote} disabled={!date || !notes[selectedDateString]?.text}>
                <Save className="mr-2 h-4 w-4" /> Save Note
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
