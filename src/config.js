export const CONFIG = {
    // Character limit for text chunks during parsing
    // Smaller chunks improve virtual scroller stability and navigation precision
    CHUNK_SIZE_LIMIT: 500,

    // Debug mode to show the active chunk trigger line (red line)
    DEBUG_MODE: false,

    // Header offset in pixels (37px title + 16px padding-top + 16px padding-bottom)
    HEADER_OFFSET: 69,

    // Average height estimate for unrendered chunks (measured by user as ~520px)
    CHUNK_HEIGHT_ESTIMATE: 520
};
