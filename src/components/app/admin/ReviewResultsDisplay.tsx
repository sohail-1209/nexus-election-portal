
"use client";

import { useState } from "react";
import type { ElectionRoom } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StarRating from "@/components/app/StarRating";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface ReviewResultsDisplayProps {
  room: ElectionRoom;
}

export default function ReviewResultsDisplay({ room }: ReviewResultsDisplayProps) {
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  
  return (
    <div className="space-y-6">
      {room.positions.map(position => {
        const totalReviews = position.reviews?.length || 0;

        return (
            <Card key={position.id} className="shadow-lg">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                            <CardTitle className="text-xl font-headline">
                                Reviews for: {position.title} - {position.candidates[0]?.name}
                            </CardTitle>
                             <CardDescription>
                                A total of {totalReviews} review(s) have been submitted.
                            </CardDescription>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2">
                            <div className="text-lg font-bold text-right">
                                Average Rating: {position.averageRating?.toFixed(2) || 'N/A'} / 5
                            </div>
                            <StarRating rating={position.averageRating || 0} onRatingChange={() => {}} disabled={true} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-md font-semibold text-muted-foreground">Individual Feedback</h4>
                        {totalReviews > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setShowAllFeedback(!showAllFeedback)}>
                                {showAllFeedback ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                                {showAllFeedback ? "Hide Feedback" : "View All Feedback"}
                            </Button>
                        )}
                    </div>
                    {totalReviews > 0 ? (
                        showAllFeedback && (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                {position.reviews?.map((review, index) => (
                                    <div key={index} className="border bg-muted/30 rounded-lg p-4">
                                        <blockquote className="text-sm italic border-l-4 border-primary pl-4">
                                        "{review.feedback || 'No written feedback provided.'}"
                                        </blockquote>
                                        <div className="flex items-center justify-between mt-3">
                                        <StarRating rating={review.rating} onRatingChange={() => {}} disabled={true} />
                                        <p className="text-xs text-muted-foreground">
                                            Submitted {formatDistanceToNow(new Date(review.reviewedAt), { addSuffix: true })}
                                        </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <div className="text-center py-12 text-muted-foreground border-dashed border-2 rounded-lg">
                            <p>No feedback entries have been submitted for this position yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
      })}
    </div>
  );
}
