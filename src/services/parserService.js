import { parseEpub } from './epubService';
import { parseDocx } from './docxService';

/**
 * Parses a book file based on its extension.
 * @param {File} file 
 * @returns {Promise<Array>}
 */
export async function parseBook(file) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.epub')) {
        return await parseEpub(file);
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        // Note: mammoth primarily supports .docx
        return await parseDocx(file);
    } else {
        throw new Error('Unsupported file format. Please use .epub or .docx');
    }
}
