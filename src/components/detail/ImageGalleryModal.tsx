import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Images } from "lucide-react";

interface ImageGalleryModalProps {
  images: string[];
  name: string;
}

export const ImageGalleryModal = ({ images, name }: ImageGalleryModalProps) => {
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (images.length <= 1) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="absolute bottom-4 right-4 z-40 bg-white/95 backdrop-blur-sm text-slate-900 hover:bg-white border-none shadow-lg rounded-2xl px-5 py-3 font-black uppercase text-xs tracking-tight flex items-center gap-2"
        >
          <Images className="h-4 w-4" />
          See All ({images.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 bg-white rounded-3xl border-none">
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
            {name} - Gallery ({images.length} photos)
          </h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setOpen(false)}
            className="rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div 
                key={idx} 
                className="aspect-square rounded-xl overflow-hidden cursor-pointer group relative"
                onClick={() => setSelectedImage(img)}
              >
                <img 
                  src={img} 
                  alt={`${name} - Photo ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {selectedImage && (
          <div 
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              <X className="h-6 w-6" />
            </Button>
            <img 
              src={selectedImage} 
              alt={name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};