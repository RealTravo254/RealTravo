 import { useState, useEffect } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Calendar } from "@/components/ui/calendar";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { format, addDays, isBefore, isAfter, parseISO } from "date-fns";
 import { CalendarIcon, Users, Check, Loader2, Minus, Plus } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { useAuth } from "@/contexts/AuthContext";
 import { supabase } from "@/integrations/supabase/client";
 
 export interface BookingFormData {
   visit_date: string;
   num_adults: number;
   num_children: number;
   guest_name: string;
   guest_email: string;
   guest_phone: string;
   selectedActivities?: { name: string; price: number; numberOfPeople: number }[];
   selectedFacilities?: { name: string; price: number; startDate?: string; endDate?: string }[];
 }
 
 interface Activity {
   name: string;
   price: number;
   images?: string[];
 }
 
 interface Facility {
   name: string;
   price: number;
   images?: string[];
 }
 
 interface MultiStepBookingProps {
   onSubmit: (data: BookingFormData) => Promise<void>;
   isProcessing: boolean;
   isCompleted: boolean;
   itemName: string;
   itemId: string;
   hostId: string;
   onPaymentSuccess: () => void;
   primaryColor?: string;
   accentColor?: string;
   bookingType?: string;
   priceAdult?: number;
   priceChild?: number;
   activities?: Activity[];
   facilities?: Facility[];
   skipFacilitiesAndActivities?: boolean;
   skipDateSelection?: boolean;
   fixedDate?: string;
   totalCapacity?: number;
   slotLimitType?: string;
   isFlexibleDate?: boolean;
   entranceType?: string;
   workingDays?: string[];
 }
 
 export const MultiStepBooking = ({
   onSubmit,
   isProcessing,
   isCompleted,
   itemName,
   priceAdult = 0,
   priceChild = 0,
   activities = [],
   facilities = [],
   skipFacilitiesAndActivities = false,
   skipDateSelection = false,
   fixedDate = "",
   totalCapacity = 100,
   workingDays = [],
   primaryColor = "#008080",
   accentColor = "#FF7F50",
 }: MultiStepBookingProps) => {
   const { user } = useAuth();
   const [currentStep, setCurrentStep] = useState(0);
   const [visitDate, setVisitDate] = useState<Date | undefined>(
     fixedDate ? parseISO(fixedDate) : undefined
   );
   const [numAdults, setNumAdults] = useState(1);
   const [numChildren, setNumChildren] = useState(0);
   const [guestName, setGuestName] = useState("");
   const [guestEmail, setGuestEmail] = useState("");
   const [guestPhone, setGuestPhone] = useState("");
   const [selectedActivities, setSelectedActivities] = useState<
     { name: string; price: number; numberOfPeople: number }[]
   >([]);
   const [selectedFacilities, setSelectedFacilities] = useState<
     { name: string; price: number; startDate?: string; endDate?: string }[]
   >([]);
 
   // Prefill user data if logged in
   useEffect(() => {
     if (user) {
       const fetchProfile = async () => {
         const { data } = await supabase
           .from("profiles")
           .select("name, phone_number")
           .eq("id", user.id)
           .single();
         if (data) {
           setGuestName(data.name || "");
           setGuestPhone(data.phone_number || "");
         }
         setGuestEmail(user.email || "");
       };
       fetchProfile();
     }
   }, [user]);
 
   const steps = [];
   
   // Step 1: Date selection (if not skipped)
   if (!skipDateSelection) {
     steps.push({ id: "date", title: "Select Date" });
   }
   
   // Step 2: Travelers
   steps.push({ id: "travelers", title: "Travelers" });
   
   // Step 3: Activities & Facilities (always show if available)
   if (!skipFacilitiesAndActivities && (activities.length > 0 || facilities.length > 0)) {
     steps.push({ id: "extras", title: "Extras" });
   }
   
   // Step 4: Guest details (if not logged in)
   if (!user) {
     steps.push({ id: "details", title: "Your Details" });
   }
   
   // Step 5: Review
   steps.push({ id: "review", title: "Review" });
 
   const calculateTotal = () => {
     let total = numAdults * priceAdult + numChildren * priceChild;
     selectedActivities.forEach((a) => (total += a.price * a.numberOfPeople));
     selectedFacilities.forEach((f) => {
       if (f.startDate && f.endDate) {
         const days = Math.max(
           1,
           Math.ceil(
             (new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) /
               (1000 * 60 * 60 * 24)
           )
         );
         total += f.price * days;
       }
     });
     return total;
   };
 
   const handleNext = () => {
     if (currentStep < steps.length - 1) {
       setCurrentStep(currentStep + 1);
     }
   };
 
   const handleBack = () => {
     if (currentStep > 0) {
       setCurrentStep(currentStep - 1);
     }
   };
 
   const handleSubmit = async () => {
     const formData: BookingFormData = {
       visit_date: visitDate ? format(visitDate, "yyyy-MM-dd") : fixedDate,
       num_adults: numAdults,
       num_children: numChildren,
       guest_name: guestName,
       guest_email: guestEmail,
       guest_phone: guestPhone,
       selectedActivities,
       selectedFacilities,
     };
     await onSubmit(formData);
   };
 
   const toggleActivity = (activity: Activity) => {
     const existing = selectedActivities.find((a) => a.name === activity.name);
     if (existing) {
       setSelectedActivities(selectedActivities.filter((a) => a.name !== activity.name));
     } else {
       setSelectedActivities([
         ...selectedActivities,
         { name: activity.name, price: activity.price, numberOfPeople: 1 },
       ]);
     }
   };
 
   const updateActivityPeople = (name: string, count: number) => {
     setSelectedActivities(
       selectedActivities.map((a) =>
         a.name === name ? { ...a, numberOfPeople: Math.max(1, count) } : a
       )
     );
   };
 
   const toggleFacility = (facility: Facility) => {
     const existing = selectedFacilities.find((f) => f.name === facility.name);
     if (existing) {
       setSelectedFacilities(selectedFacilities.filter((f) => f.name !== facility.name));
     } else {
       setSelectedFacilities([
         ...selectedFacilities,
         { name: facility.name, price: facility.price },
       ]);
     }
   };
 
   const updateFacilityDates = (name: string, startDate?: string, endDate?: string) => {
     setSelectedFacilities(
       selectedFacilities.map((f) =>
         f.name === name ? { ...f, startDate, endDate } : f
       )
     );
   };
 
   const currentStepId = steps[currentStep]?.id;
 
   const isStepValid = () => {
     switch (currentStepId) {
       case "date":
         return !!visitDate;
       case "travelers":
         return numAdults > 0;
       case "extras":
         return true;
       case "details":
         return guestName.trim() && guestEmail.trim() && guestPhone.trim();
       case "review":
         return true;
       default:
         return true;
     }
   };
 
   if (isCompleted) {
     return (
       <div className="p-8 text-center">
         <div
           className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
           style={{ backgroundColor: primaryColor }}
         >
           <Check className="h-8 w-8 text-white" />
         </div>
         <h3 className="text-xl font-bold mb-2">Booking Confirmed!</h3>
         <p className="text-muted-foreground">Thank you for booking {itemName}</p>
       </div>
     );
   }
 
   return (
     <div className="p-6">
       {/* Progress indicator */}
       <div className="flex items-center justify-between mb-8">
         {steps.map((step, index) => (
           <div key={step.id} className="flex items-center">
             <div
               className={cn(
                 "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                 index <= currentStep
                   ? "text-white"
                   : "bg-muted text-muted-foreground"
               )}
               style={{
                 backgroundColor: index <= currentStep ? primaryColor : undefined,
               }}
             >
               {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
             </div>
             {index < steps.length - 1 && (
               <div
                 className={cn(
                   "h-1 w-8 mx-1",
                   index < currentStep ? "" : "bg-muted"
                 )}
                 style={{
                   backgroundColor: index < currentStep ? primaryColor : undefined,
                 }}
               />
             )}
           </div>
         ))}
       </div>
 
       <h2 className="text-lg font-bold mb-6">{steps[currentStep]?.title}</h2>
 
       {/* Date Selection Step */}
       {currentStepId === "date" && (
         <div className="space-y-4">
           <Label>When would you like to visit?</Label>
           <Popover>
             <PopoverTrigger asChild>
               <Button
                 variant="outline"
                 className={cn(
                   "w-full justify-start text-left font-normal",
                   !visitDate && "text-muted-foreground"
                 )}
               >
                 <CalendarIcon className="mr-2 h-4 w-4" />
                 {visitDate ? format(visitDate, "PPP") : "Select a date"}
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-auto p-0">
               <Calendar
                 mode="single"
                 selected={visitDate}
                 onSelect={setVisitDate}
                 disabled={(date) => isBefore(date, new Date())}
                 initialFocus
               />
             </PopoverContent>
           </Popover>
         </div>
       )}
 
       {/* Travelers Step */}
       {currentStepId === "travelers" && (
         <div className="space-y-6">
           <div className="flex items-center justify-between p-4 border rounded-xl">
             <div>
               <p className="font-semibold">Adults</p>
               <p className="text-sm text-muted-foreground">
                 KES {priceAdult.toLocaleString()} each
               </p>
             </div>
             <div className="flex items-center gap-3">
               <Button
                 variant="outline"
                 size="icon"
                 onClick={() => setNumAdults(Math.max(1, numAdults - 1))}
               >
                 <Minus className="h-4 w-4" />
               </Button>
               <span className="w-8 text-center font-bold">{numAdults}</span>
               <Button
                 variant="outline"
                 size="icon"
                 onClick={() => setNumAdults(Math.min(totalCapacity, numAdults + 1))}
               >
                 <Plus className="h-4 w-4" />
               </Button>
             </div>
           </div>
 
           <div className="flex items-center justify-between p-4 border rounded-xl">
             <div>
               <p className="font-semibold">Children</p>
               <p className="text-sm text-muted-foreground">
                 KES {priceChild.toLocaleString()} each
               </p>
             </div>
             <div className="flex items-center gap-3">
               <Button
                 variant="outline"
                 size="icon"
                 onClick={() => setNumChildren(Math.max(0, numChildren - 1))}
               >
                 <Minus className="h-4 w-4" />
               </Button>
               <span className="w-8 text-center font-bold">{numChildren}</span>
               <Button
                 variant="outline"
                 size="icon"
                 onClick={() =>
                   setNumChildren(Math.min(totalCapacity - numAdults, numChildren + 1))
                 }
               >
                 <Plus className="h-4 w-4" />
               </Button>
             </div>
           </div>
         </div>
       )}
 
       {/* Extras Step (Activities & Facilities) */}
       {currentStepId === "extras" && (
         <div className="space-y-6">
           {activities.length > 0 && (
             <div>
               <h3 className="font-semibold mb-3">Activities</h3>
               <div className="space-y-3">
                 {activities.map((activity) => {
                   const isSelected = selectedActivities.some(
                     (a) => a.name === activity.name
                   );
                   const selected = selectedActivities.find(
                     (a) => a.name === activity.name
                   );
                   return (
                     <div
                       key={activity.name}
                       className={cn(
                         "p-4 border rounded-xl cursor-pointer transition-all",
                         isSelected && "border-2"
                       )}
                       style={{
                         borderColor: isSelected ? primaryColor : undefined,
                       }}
                       onClick={() => toggleActivity(activity)}
                     >
                       <div className="flex justify-between items-center">
                         <div>
                           <p className="font-medium">{activity.name}</p>
                           <p className="text-sm text-muted-foreground">
                             KES {activity.price.toLocaleString()} per person
                           </p>
                         </div>
                         {isSelected && (
                           <div
                             className="flex items-center gap-2"
                             onClick={(e) => e.stopPropagation()}
                           >
                             <Button
                               variant="outline"
                               size="icon"
                               className="h-8 w-8"
                               onClick={() =>
                                 updateActivityPeople(
                                   activity.name,
                                   (selected?.numberOfPeople || 1) - 1
                                 )
                               }
                             >
                               <Minus className="h-3 w-3" />
                             </Button>
                             <span className="w-6 text-center">
                               {selected?.numberOfPeople || 1}
                             </span>
                             <Button
                               variant="outline"
                               size="icon"
                               className="h-8 w-8"
                               onClick={() =>
                                 updateActivityPeople(
                                   activity.name,
                                   (selected?.numberOfPeople || 1) + 1
                                 )
                               }
                             >
                               <Plus className="h-3 w-3" />
                             </Button>
                           </div>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}
 
           {facilities.length > 0 && (
             <div>
               <h3 className="font-semibold mb-3">Facilities</h3>
               <div className="space-y-3">
                 {facilities.map((facility) => {
                   const isSelected = selectedFacilities.some(
                     (f) => f.name === facility.name
                   );
                   const selected = selectedFacilities.find(
                     (f) => f.name === facility.name
                   );
                   return (
                     <div
                       key={facility.name}
                       className={cn(
                         "p-4 border rounded-xl cursor-pointer transition-all",
                         isSelected && "border-2"
                       )}
                       style={{
                         borderColor: isSelected ? primaryColor : undefined,
                       }}
                       onClick={() => toggleFacility(facility)}
                     >
                       <div className="flex justify-between items-center">
                         <div>
                           <p className="font-medium">{facility.name}</p>
                           <p className="text-sm text-muted-foreground">
                             KES {facility.price.toLocaleString()} per day
                           </p>
                         </div>
                       </div>
                       {isSelected && (
                         <div
                           className="mt-3 grid grid-cols-2 gap-2"
                           onClick={(e) => e.stopPropagation()}
                         >
                           <div>
                             <Label className="text-xs">Start Date</Label>
                             <Input
                               type="date"
                               value={selected?.startDate || ""}
                               onChange={(e) =>
                                 updateFacilityDates(
                                   facility.name,
                                   e.target.value,
                                   selected?.endDate
                                 )
                               }
                             />
                           </div>
                           <div>
                             <Label className="text-xs">End Date</Label>
                             <Input
                               type="date"
                               value={selected?.endDate || ""}
                               onChange={(e) =>
                                 updateFacilityDates(
                                   facility.name,
                                   selected?.startDate,
                                   e.target.value
                                 )
                               }
                             />
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             </div>
           )}
         </div>
       )}
 
       {/* Guest Details Step */}
       {currentStepId === "details" && (
         <div className="space-y-4">
           <div>
             <Label>Full Name</Label>
             <Input
               value={guestName}
               onChange={(e) => setGuestName(e.target.value)}
               placeholder="Enter your full name"
             />
           </div>
           <div>
             <Label>Email</Label>
             <Input
               type="email"
               value={guestEmail}
               onChange={(e) => setGuestEmail(e.target.value)}
               placeholder="Enter your email"
             />
           </div>
           <div>
             <Label>Phone</Label>
             <Input
               type="tel"
               value={guestPhone}
               onChange={(e) => setGuestPhone(e.target.value)}
               placeholder="Enter your phone number"
             />
           </div>
         </div>
       )}
 
       {/* Review Step */}
       {currentStepId === "review" && (
         <div className="space-y-4">
           <div className="p-4 bg-muted rounded-xl space-y-2">
             <div className="flex justify-between">
               <span>Date</span>
               <span className="font-medium">
                 {visitDate ? format(visitDate, "PPP") : fixedDate || "Flexible"}
               </span>
             </div>
             <div className="flex justify-between">
               <span>Adults × {numAdults}</span>
               <span>KES {(numAdults * priceAdult).toLocaleString()}</span>
             </div>
             {numChildren > 0 && (
               <div className="flex justify-between">
                 <span>Children × {numChildren}</span>
                 <span>KES {(numChildren * priceChild).toLocaleString()}</span>
               </div>
             )}
             {selectedActivities.map((a) => (
               <div key={a.name} className="flex justify-between">
                 <span>
                   {a.name} × {a.numberOfPeople}
                 </span>
                 <span>KES {(a.price * a.numberOfPeople).toLocaleString()}</span>
               </div>
             ))}
             {selectedFacilities.map((f) => {
               const days =
                 f.startDate && f.endDate
                   ? Math.max(
                       1,
                       Math.ceil(
                         (new Date(f.endDate).getTime() -
                           new Date(f.startDate).getTime()) /
                           (1000 * 60 * 60 * 24)
                       )
                     )
                   : 1;
               return (
                 <div key={f.name} className="flex justify-between">
                   <span>
                     {f.name} ({days} days)
                   </span>
                   <span>KES {(f.price * days).toLocaleString()}</span>
                 </div>
               );
             })}
             <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
               <span>Total</span>
               <span style={{ color: primaryColor }}>
                 KES {calculateTotal().toLocaleString()}
               </span>
             </div>
           </div>
 
           <div className="p-4 border rounded-xl space-y-1">
             <p className="font-medium">{guestName || user?.email}</p>
             <p className="text-sm text-muted-foreground">{guestEmail || user?.email}</p>
             <p className="text-sm text-muted-foreground">{guestPhone}</p>
           </div>
         </div>
       )}
 
       {/* Navigation buttons */}
       <div className="flex gap-3 mt-8">
         {currentStep > 0 && (
           <Button variant="outline" onClick={handleBack} className="flex-1">
             Back
           </Button>
         )}
         {currentStep < steps.length - 1 ? (
           <Button
             onClick={handleNext}
             disabled={!isStepValid()}
             className="flex-1"
             style={{ backgroundColor: primaryColor }}
           >
             Continue
           </Button>
         ) : (
           <Button
             onClick={handleSubmit}
             disabled={isProcessing}
             className="flex-1"
             style={{ backgroundColor: accentColor }}
           >
             {isProcessing ? (
               <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 Processing...
               </>
             ) : (
               "Confirm Booking"
             )}
           </Button>
         )}
       </div>
     </div>
   );
 };