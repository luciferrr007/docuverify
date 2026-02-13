import { QrCode } from "lucide-react";

const QRPlaceholder = () => (
  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8">
    <QrCode className="mb-3 h-16 w-16 text-muted-foreground/50" />
    <p className="text-sm font-medium text-muted-foreground">QR Code Placeholder</p>
    <p className="text-xs text-muted-foreground/70">QR output</p>
  </div>
);

export default QRPlaceholder;
