import { ARMOR_WRAP_COLUMNS } from '@/postcard/constants';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=-';
// Include common ASCII armor header symbols and spacing.
const PGP_WHITELIST = `${BASE64} \n\r\t-:_[]()<>.,'\"`;

type Logger = (m: any) => void;

let workerPromise: Promise<any> | null = null;
let activeLogger: Logger | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const mod = await import('tesseract.js');
      const worker = await mod.createWorker('eng', mod.OEM.LSTM_ONLY, {
        logger: (m: any) => {
          activeLogger?.(m);
        },
      });

      await worker.setParameters({
        // Disable dictionary-based correction; we want strict symbol OCR.
        load_system_dawg: '0',
        load_freq_dawg: '0',
        // Keep spaces when possible (OCR sometimes collapses them).
        preserve_interword_spaces: '1',
        // Restrict character set to ASCII armor + base64.
        tessedit_char_whitelist: PGP_WHITELIST,
        // Treat as a block of text.
        tessedit_pageseg_mode: mod.PSM.SINGLE_BLOCK as any,
        // Help when OCR sees low-DPI screenshots.
        user_defined_dpi: '300',
      } as any);

      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizePgpText(
  input: Blob | File,
  options: { logger?: Logger; label?: string } = {},
): Promise<string> {
  const worker = await getWorker();
  activeLogger = options.logger ?? null;
  try {
    const result = await worker.recognize(input);
    return result?.data?.text ?? '';
  } finally {
    activeLogger = null;
  }
}

export function getPgpOcrDefaults() {
  return {
    wrapColumns: ARMOR_WRAP_COLUMNS,
    whitelist: PGP_WHITELIST,
  };
}
