import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";

export const ApprovedTab = ({ approvedListings, handleToggleVisibility }: any) => (
  <>
    {approvedListings.length === 0 ? (
      <p className="text-muted-foreground">No approved listings</p>
    ) : (
      approvedListings.map((item: any) => (
        <Card key={item.id} className="p-6">
          <div className="flex gap-4">
            <img 
              src={item.image_url} 
              alt={item.name}
              className="w-32 h-32 object-cover rounded"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold">{item.name}</h3>
                <Badge className="capitalize">{item.type}</Badge>
                <Badge variant={item.approval_status === 'approved' ? 'default' : 'destructive'}>
                  {item.approval_status}
                </Badge>
                {item.is_hidden && <Badge variant="secondary">Hidden</Badge>}
                {item.establishment_type && (
                  <Badge variant="outline" className="capitalize">{item.establishment_type}</Badge>
                )}
              </div>
              
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                <p><span className="font-medium">Location:</span> {item.location}, {item.place}, {item.country}</p>
                <p><span className="font-medium">Created:</span> {new Date(item.created_at).toLocaleDateString()}</p>
                
                {item.registration_number && (
                  <p><span className="font-medium">Registration #:</span> {item.registration_number}</p>
                )}
                
                {item.email && (
                  <p><span className="font-medium">Creator Email:</span> {item.email}</p>
                )}
                
                {item.phone_number && (
                  <p><span className="font-medium">Creator Phone:</span> {item.phone_number}</p>
                )}
                
                {item.phone_numbers && item.phone_numbers.length > 0 && (
                  <p><span className="font-medium">Creator Phone:</span> {item.phone_numbers.join(', ')}</p>
                )}
                
                {item.price && (
                  <p><span className="font-medium">Price:</span> ${item.price}</p>
                )}
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={() => handleToggleVisibility(item.id, item.type)}
                  variant={item.is_hidden ? "default" : "outline"}
                  size="sm"
                >
                  {item.is_hidden ? (
                    <><Eye className="h-4 w-4 mr-1" />Publish</>
                  ) : (
                    <><EyeOff className="h-4 w-4 mr-1" />Hide</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))
    )}
  </>
);
