declare module 'react-qr-scanner' {
  import type { ComponentType } from 'react';

  export type QrScannerProps = {
    onScan: (result: unknown) => void;
    onError: (error: unknown) => void;
    onLoad?: () => void;
    delay?: number | false;
    facingMode?: 'front' | 'rear' | string;
    legacyMode?: boolean;
    maxImageSize?: number;
    style?: Record<string, unknown>;
    className?: string;
    constraints?: MediaStreamConstraints | Record<string, unknown>;
    chooseDeviceId?: (matching: MediaDeviceInfo[], all: MediaDeviceInfo[]) => string;
    initialStream?: MediaStream;
    resolution?: number;
    qrArea?: number;
  };

  const QrScanner: ComponentType<QrScannerProps>;
  export default QrScanner;
}

