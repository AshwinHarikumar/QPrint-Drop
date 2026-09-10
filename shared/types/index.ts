export interface TransferSession {
  sessionId: string;
  status: "waiting" | "active" | "expired" | "closed";
  createdAt: number;
  expiresAt: number;
  desktopConnected: boolean;
  uploaderConnected: boolean;
  jobCount: number;
}

export interface PrintSettings {
  copies: number;
  orientation: "auto" | "portrait" | "landscape";
  colorMode: "color" | "bw";
  paperSize: "A4" | "A3" | "Letter" | "Legal";
  duplex: "off" | "longEdge" | "shortEdge";
}

export interface PrintJob {
  id: string;
  sessionId: string;
  originalFilename: string;
  storedFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  status:
    | "uploading"
    | "uploaded"
    | "received"
    | "previewing"
    | "queued"
    | "printing"
    | "completed"
    | "failed"
    | "cancelled"
    | "deleted";
  printSettings: PrintSettings;
  createdAt: number;
}
