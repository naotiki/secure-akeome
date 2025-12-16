// Tune for OCR readability on printed postcard.
// Wider fonts => fewer columns/lines to avoid overflow.
export const POSTCARD_TEXT_SCALE = 2;

const BASE_ARMOR_WRAP_COLUMNS = 65;
const BASE_POSTCARD_LINES_PER_PAGE = 80;

export const ARMOR_WRAP_COLUMNS = Math.max(65, Math.floor(BASE_ARMOR_WRAP_COLUMNS / POSTCARD_TEXT_SCALE));
export const POSTCARD_LINES_PER_PAGE = Math.max(20, Math.floor(BASE_POSTCARD_LINES_PER_PAGE / POSTCARD_TEXT_SCALE));

// How many checksum blocks to print per page (split into two columns).
export const CHECKSUM_BLOCKS_PER_PAGE = 30;

// QR (bottom-right) for checksums.
export const CHECKSUM_QR_SIZE_PX = 300;
