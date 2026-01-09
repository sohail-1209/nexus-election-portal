
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-10 w-48" /> {/* Back button */}
      
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column Skeleton */}
        <div className="w-full lg:w-3/5 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4 mb-2" /> {/* Title */}
              <Skeleton className="h-4 w-1/2" /> {/* Description */}
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Form Skeletons */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" /> {/* Label */}
                <Skeleton className="h-10 w-full" /> {/* Input */}
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" /> {/* Label */}
                <Skeleton className="h-24 w-full" /> {/* Textarea */}
              </div>
              <Skeleton className="h-10 w-full border p-4" /> {/* Checkbox item */}
              
              {/* Positions Skeletons */}
              <div>
                <Skeleton className="h-6 w-1/3 mb-4" /> {/* Positions Title */}
                <div className="space-y-4">
                  {[1, 2].map(i => (
                    <Card key={i}>
                      <CardHeader className="py-3 px-4 border-b">
                        <Skeleton className="h-5 w-1/4" />
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                         <Skeleton className="h-10 w-full" /> {/* Candidate Input */}
                         <Skeleton className="h-8 w-1/3 mt-2" /> {/* Add candidate button */}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                 <Skeleton className="h-10 w-full mt-4" /> {/* Add position button */}
              </div>
              <Skeleton className="h-12 w-full" /> {/* Submit button */}
            </CardContent>
          </Card>
        </div>

        {/* Right Column Skeleton */}
        <div className="w-full lg:w-2/5 space-y-6">
           <Card>
              <CardHeader>
                  <Skeleton className="h-7 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                  <Skeleton className="h-40 w-full" />
              </CardContent>
           </Card>
           <Card>
              <CardHeader>
                  <Skeleton className="h-7 w-1/2" />
                  <Skeleton className="h-4 w-3/4 mt-1" />
              </CardHeader>
              <CardContent>
                  <Skeleton className="h-10 w-1/2" />
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
