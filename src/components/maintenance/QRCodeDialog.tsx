import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import QRCode from "qrcode";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: {
    id: string;
    location_name: string;
    location_description?: string;
    qr_code_data: string;
    projects: { name: string };
  };
}

export const QRCodeDialog = ({ open, onOpenChange, qrCode }: QRCodeDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && canvasRef.current && qrCode.qr_code_data) {
      generateQRCode();
    }
  }, [open, qrCode.qr_code_data, qrCode]);

  const generateQRCode = async () => {
    if (!canvasRef.current || !qrCode.qr_code_data) {
      console.error("Canvas ref or QR code data not available");
      return;
    }

    try {
      console.log("Generating QR Code for:", qrCode.qr_code_data);
      await QRCode.toCanvas(canvasRef.current, qrCode.qr_code_data, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: 'H',
      });
      console.log("QR Code generated successfully");
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const url = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `qr-code-${qrCode.location_name.replace(/\s+/g, "-")}.png`;
    link.href = url;
    link.click();
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const imageUrl = canvasRef.current.toDataURL("image/png");
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${qrCode.location_name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .container {
              text-align: center;
              border: 2px solid #000;
              padding: 30px;
              border-radius: 10px;
            }
            h1 {
              margin-bottom: 10px;
              font-size: 24px;
            }
            p {
              margin: 5px 0;
              color: #666;
            }
            img {
              margin: 20px 0;
            }
            .instructions {
              margin-top: 20px;
              font-size: 14px;
              color: #333;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${qrCode.location_name}</h1>
            <p><strong>Projeto:</strong> ${qrCode.projects.name}</p>
            ${qrCode.location_description ? `<p>${qrCode.location_description}</p>` : ''}
            <img src="${imageUrl}" alt="QR Code" />
            <div class="instructions">
              <p><strong>Escaneie este QR Code para solicitar manutenção</strong></p>
              <p>Aponte a câmera do celular para o código acima</p>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{qrCode.location_name}</DialogTitle>
          <DialogDescription>
            Projeto: {qrCode.projects.name}
            {qrCode.location_description && (
              <span className="block mt-1">{qrCode.location_description}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="bg-white p-4 rounded-lg">
            <canvas ref={canvasRef} className="border-2 border-gray-200 rounded-lg" style={{ minWidth: '300px', minHeight: '300px' }} />
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Escaneie este QR Code para solicitar manutenção</p>
            <p className="text-xs mt-1">
              Link: <span className="font-mono text-xs break-all">{qrCode.qr_code_data}</span>
            </p>
          </div>

          <div className="flex gap-2 w-full">
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Baixar PNG
            </Button>
            <Button onClick={handlePrint} className="flex-1">
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
