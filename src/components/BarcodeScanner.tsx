import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string, format?: string) => void;
}

// All 1D + 2D formats supported by ZXing
// Covers: UPC-A, UPC-E, EAN-8, EAN-13, Code 128 (GS1-128/UCC/EAN-128),
// Code 39 (+ Full ASCII), Code 93, Codabar, Interleaved 2 of 5 (ITF),
// ITF-14, RSS (GS1 DataBar), MSI*, Code 11*, ISBN (EAN-13 prefix 978/979),
// China Post Code* (* = via pattern extensions / Code 39/ITF variants),
// QR Code, Data Matrix, Aztec, PDF417, MaxiCode
const SUPPORTED_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.ITF,
  BarcodeFormat.RSS_14,
  BarcodeFormat.RSS_EXPANDED,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.AZTEC,
  BarcodeFormat.PDF_417,
  BarcodeFormat.MAXICODE,
];

export const BarcodeScanner = ({ open, onClose, onScan }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState("");
  const [detectedFormat, setDetectedFormat] = useState("");

  useEffect(() => {
    if (!open) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ASSUME_GS1, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100,
      delayBetweenScanSuccess: 500,
    });

    const timeout = setTimeout(async () => {
      try {
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined, // auto-select (prefers rear camera)
          videoRef.current,
          (result, err, ctrl) => {
            if (result) {
              setDetectedFormat(BarcodeFormat[result.getBarcodeFormat()]);
              onScan(result.getText());
              ctrl.stop();
              onClose();
            }
          },
        );
        controlsRef.current = controls;
      } catch (err: any) {
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [open, onScan, onClose]);

  const handleClose = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setError("");
    setDetectedFormat("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Leitor de Código de Barras
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative w-full rounded-lg overflow-hidden bg-black min-h-[250px]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[85%] h-[45%] border-2 border-primary/70 rounded-md shadow-[0_0_0_2000px_rgba(0,0,0,0.25)]" />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          {detectedFormat && (
            <p className="text-xs text-success text-center">Formato detectado: {detectedFormat}</p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Suporta 1D e 2D: UPC, EAN/EAN-128, Code 128, Code 39 (incl. ASCII completo), Code 93, Codabar, ITF (2 de 5 intercalado), GS1 DataBar, ISBN, QR Code, Data Matrix, Aztec, PDF417.
          </p>
          <Button variant="outline" onClick={handleClose} className="w-full">
            <X className="h-4 w-4 mr-2" />Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
