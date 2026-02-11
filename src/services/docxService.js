import mammoth from 'mammoth';
import { CONFIG } from '../config';

/**
 * Parses a .docx file and extracts text chunks.
 * @param {File|ArrayBuffer} fileData 
 * @returns {Promise<Array>}
 */
export async function parseDocx(fileData) {
    let arrayBuffer;
    if (fileData instanceof File) {
        arrayBuffer = await fileData.arrayBuffer();
    } else {
        arrayBuffer = fileData;
    }

    // Convert docx to HTML using mammoth
    // We use convertToHtml to preserve some structure (paragraphs, headers)
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    const html = result.value;
    const messages = result.messages;
    if (DEBUG_MODE) { console.log("Mammoth messages:", messages); }

    // Parse HTML to extract chunks
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    let items = [];
    let idCounter = 0;

    // Attempt to extract title from first heading or filename
    let bookTitle = "Untitled Document";
    if (fileData instanceof File) {
        bookTitle = fileData.name.replace(/\.[^/.]+$/, "");
    }

    const h1 = body.querySelector('h1');
    if (h1) bookTitle = h1.innerText.trim();

    // Smart Chunking Buffer
    let buffer = {
        text: "",
    };

    const flushBuffer = () => {
        if (buffer.text.trim().length > 0) {
            items.push({
                id: `docx-chunk-${idCounter++}`,
                type: 'text',
                content: buffer.text.trim(),
                bookTitle: bookTitle,
                chapter: "Document",
                timestamp: new Date().toISOString()
            });
            buffer.text = "";
        }
    };

    // Traverse elements
    const children = Array.from(body.children);
    for (const node of children) {
        const tagName = node.tagName.toUpperCase();
        const text = node.innerText ? node.innerText.trim() : node.textContent.trim();

        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
            flushBuffer();
            items.push({
                id: `docx-head-${idCounter++}`,
                type: 'header',
                content: text,
                bookTitle: bookTitle,
                chapter: text,
                timestamp: new Date().toISOString()
            });
        } else if (['P', 'LI', 'BLOCKQUOTE'].includes(tagName)) {
            if (text.length > 0) {
                if (buffer.text.length + text.length > CONFIG.CHUNK_SIZE_LIMIT) {
                    flushBuffer();
                    buffer.text = text;
                } else {
                    if (buffer.text.length > 0) buffer.text += "\n\n";
                    buffer.text += text;
                }
            }
        }
    }

    flushBuffer();

    return items;
}
