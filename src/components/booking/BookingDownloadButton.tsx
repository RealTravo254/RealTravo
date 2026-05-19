import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { BookingPDFData, generateQRCodeData, downloadBookingAsPDF } from "@/lib/pdfBookingExport";
import { toast } from "sonner";

interface BookingDownloadButtonProps {
  booking: BookingPDFData;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const BookingDownloadButton = ({
  booking,
  variant = "outline",
  size = "sm",
  className,
}: BookingDownloadButtonProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const qrData = generateQRCodeData(booking);

  const getQRDataUrl = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = qrRef.current;

      if (canvas) {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          if (dataUrl && dataUrl.length > 100 && dataUrl !== "data:,") {
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn("canvas.toDataURL failed:", e);
        }
      }

      // Fallback: dynamically mount a fresh QRCodeCanvas into a temporary
      // zero-size inline container appended to document.body.
      const container = document.createElement("div");
      container.style.cssText =
        "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;top:0;left:0;";
      document.body.appendChild(container);

      import("react-dom/client")
        .then(({ createRoot }) =>
          import("react").then((React) => {
            const root = createRoot(container);
            root.render(
              React.createElement(QRCodeCanvas, {
                value: qrData,
                size: 256,
                level: "H",
                includeMargin: true,
              })
            );

            requestAnimationFrame(() => {
              setTimeout(() => {
                try {
                  const tempCanvas = container.querySelector("canvas");
                  if (!tempCanvas) {
                    reject(new Error("QR canvas not found after render"));
                    return;
                  }
                  const dataUrl = tempCanvas.toDataURL("image/png");
                  if (dataUrl && dataUrl.length > 100 && dataUrl !== "data:,") {
                    resolve(dataUrl);
                  } else {
                    reject(new Error("QR canvas produced empty data URL"));
                  }
                } catch (err) {
                  reject(err);
                } finally {
                  root.unmount();
                  if (document.body.contains(container)) {
                    document.body.removeChild(container);
                  }
                }
              }, 200);
            });
          })
        )
        .catch(reject);
    });
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const qrCodeDataUrl = await getQRDataUrl();
      await downloadBookingAsPDF(booking, qrCodeDataUrl);
      toast.success("Booking downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download booking. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {/*
        Inline hidden canvas — keeps the QR inside the same render tree so it
        always paints on iOS Safari / Chrome Android inside Radix Sheet/Dialog.
      */}
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 0,
          height: 0,
          overflow: "hidden",
          verticalAlign: "top",
        }}
      >
        <QRCodeCanvas ref={qrRef} value={qrData} size={256} level="H" includeMargin />
      </span>

      <Button
        variant={variant}
        size={size}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        disabled={isDownloading}
        className={className}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      >
        {isDownloading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Downloading...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download Booking
          </>
        )}
      </Button>
    </>
  );
};