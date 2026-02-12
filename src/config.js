export const CONFIG = {

    // Debug mode to show the active chunk trigger line (red line)
    DEBUG_MODE: false,

    // Enable keyboard navigation with arrow keys (up/down) to navigate between chunks
    KEYBOARD_NAVIGATION: true,

    // Header offset in pixels (37px title + 16px padding-top + 16px padding-bottom)
    HEADER_OFFSET: 69,

    // Average height estimate for unrendered chunks (measured by user as ~520px)
    CHUNK_HEIGHT_ESTIMATE: 520,

    // Character limit for text chunks during parsing
    // Smaller chunks improve virtual scroller stability and navigation precision
    CHUNK_SIZE_LIMIT: 500,
    MIN_PARAGRAPH_LENGTH: 120,   // si es más corto, se agrupa
    MAX_CHUNK_LENGTH: 900       // si buffer supera esto, flush
};
