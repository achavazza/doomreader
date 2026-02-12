import ePub from 'epubjs'
import { CONFIG } from '../config'

/**
 * Resolves a relative path to an absolute path within the EPUB archive.
 * @param {string} relativePath 
 * @param {string} currentPath 
 */
function resolvePath(relativePath, currentPath) {
    // Normalize logic
    const parts = currentPath.split('/')
    parts.pop() // Remove filename

    // Handle leading slash (absolute within root?)
    if (relativePath.startsWith('/')) {
        // Assume relative to root, but where is root?
        // Usually, internal links in epub are relative.
        relativePath = relativePath.substring(1)
        // Reset parts?
        // parts = []
    }

    const relParts = relativePath.split('/')

    for (const part of relParts) {
        if (part === '..') {
            parts.pop()
        } else if (part !== '.' && part !== '') {
            parts.push(part)
        }
    }

    return parts.join('/')
}

async function blobToBase64(blob) {
    try {
        if (!blob) return null;

        // Handle Uint8Array/ArrayBuffer which epubjs sometimes returns
        if (blob instanceof Uint8Array || blob instanceof ArrayBuffer) {
            blob = new Blob([blob]);
        }

        if (!(blob instanceof Blob)) {
            console.warn("blobToBase64: Provided item is not a Blob", typeof blob);
            return null;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = (e) => reject(new Error("FileReader error: " + e.target.error));
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error("Error in blobToBase64", err);
        return null;
    }
}

/**
 * Robustly gets a blob from an EPUB book instance.
 * @param {Object} book 
 * @param {string} path 
 */
async function getImageBlob(book, path) {
    if (!path) return null;

    // 1. If it's already a URL
    if (path.startsWith('blob:') || path.startsWith('http')) {
        try {
            const res = await fetch(path);
            if (res.ok) return await res.blob();
        } catch (e) {
            console.warn("Failed to fetch image URL", path, e);
        }
    }

    // 2. Try direct archive access
    try {
        const blob = await book.archive.getBlob(path);
        if (blob) return blob;
    } catch (e) { }

    // 3. Try book.load (sometimes more reliable for nested paths)
    try {
        const blob = await book.load(path, 'blob');
        if (blob) return blob;
    } catch (e) { }

    return null;
}

/**
 * Parses an EPUB file and extracts paragraphs and images.
 * @param {File|ArrayBuffer} fileData 
 * @returns {Promise<Array>}
 */
export async function parseEpub(fileData) {
    const book = ePub(fileData)
    await book.ready

    const metadata = await book.loaded.metadata

    // Robust metadata extraction
    let bookTitle = metadata.title || (book.package && book.package.metadata ? book.package.metadata.title : null) || "Untitled Book"
    let creator = metadata.creator
    if (!creator && book.package && book.package.metadata) creator = book.package.metadata.creator
    if (typeof creator === 'object') creator = creator["#text"] || creator.name || "Unknown Author"
    if (!creator) creator = "Unknown Author"

    // Convert cover to Base64 immediately
    let coverUrl = null
    try {
        let coverPath = await book.coverUrl()
        if (!coverPath && book.package && book.package.metadata) {
            const coverId = book.package.metadata.cover
            if (coverId) {
                const item = book.package.manifest[coverId]
                if (item) coverPath = item.href
            }
        }
        if (coverPath) {
            const blob = await getImageBlob(book, coverPath)
            if (blob) coverUrl = await blobToBase64(blob)
        }
    } catch (e) {
        console.warn("Failed to process cover", e)
    }

    const spine = book.spine
    let items = []
    let idCounter = 0
    let buffer = { text: "" }
    let currentChapterTitle = "Start"

    const flushBuffer = (chapter) => {
        if (buffer.text.trim().length > 0) {
            items.push({
                id: `chunk-${idCounter++}`,
                type: 'text',
                content: buffer.text.trim(),
                bookTitle: bookTitle,
                creator: creator,
                chapter: chapter,
                timestamp: new Date().toISOString()
            })
            buffer.text = ""
        }
    }

    // -----------------------------
    // OLD TRAVERSE (backup)
    // -----------------------------
    /*
    // TRAVERSAL: More robust version to capture text from any element
    const traverse = (node) => {
        if (!node) return

        const tagName = node.tagName ? node.tagName.toUpperCase() : ''

        // Skip media entirely for performance as requested
        if (['IMG', 'IMAGE', 'SVG', 'VIDEO', 'AUDIO', 'IFRAME'].includes(tagName)) return

        // If it's a block-level text element or a heading
        if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'SECTION', 'ARTICLE'].includes(tagName)) {
            // Check if this node has direct text content or just children
            // We use a simple rule: if it has direct text nodes that aren't just whitespace, process it
            // but ONLY if it's not a generic container for other block elements.

            const isHeading = tagName.startsWith('H')
            const text = node.innerText ? node.innerText.trim() : ""

            if (text.length > 0) {
                // If it's a heading, flush and start new
                if (isHeading) {
                    flushBuffer(currentChapterTitle)
                    items.push({
                        id: `head-${idCounter++}`,
                        type: 'header',
                        content: text,
                        chapter: text,
                        bookTitle: bookTitle,
                        creator: creator
                    })
                    currentChapterTitle = text
                    return
                }

                // If this is a container (like DIV) and has block-level children, recurse instead of taking text here
                const hasBlockChildren = Array.from(node.children).some(child =>
                    ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'SECTION'].includes(child.tagName.toUpperCase())
                )

                if (hasBlockChildren && (tagName === 'DIV' || tagName === 'SECTION')) {
                    Array.from(node.children).forEach(traverse)
                } else {
                    // It's a "leaf" block or a simple paragraph/div
                    if (buffer.text.length + text.length > CONFIG.CHUNK_SIZE_LIMIT) {
                        flushBuffer(currentChapterTitle)
                        buffer.text = text
                    } else {
                        if (buffer.text.length > 0) buffer.text += "\n\n"
                        buffer.text += text
                    }
                }
            } else if (node.children.length > 0) {
                Array.from(node.children).forEach(traverse)
            }
        } else if (node.children && node.children.length > 0) {
            Array.from(node.children).forEach(traverse)
        }
    }
    */

    // -----------------------------
    // NEW TRAVERSE (smart chunking)
    // -----------------------------
    const MIN_PARAGRAPH_LENGTH = CONFIG.MIN_PARAGRAPH_LENGTH || 120
    const SOFT_LIMIT = CONFIG.CHUNK_SIZE_LIMIT || 500
    const HARD_LIMIT = CONFIG.MAX_CHUNK_LENGTH || SOFT_LIMIT

    const isDialogueLine = (text) => {
        if (!text) return false
        return (
            text.startsWith("—") ||
            text.startsWith("-") ||
            text.startsWith("“") ||
            text.startsWith("\"") ||
            text.endsWith(":")
        )
    }

    const appendToBuffer = (text) => {
        if (!text) return
        if (buffer.text.length > 0) buffer.text += "\n\n"
        buffer.text += text
    }

    const traverse = (node) => {
        if (!node) return

        const tagName = node.tagName ? node.tagName.toUpperCase() : ''

        // Skip media
        if (['IMG', 'IMAGE', 'SVG', 'VIDEO', 'AUDIO', 'IFRAME'].includes(tagName)) return

        // HEADINGS: cut chapter + flush
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tagName)) {
            const text = node.innerText ? node.innerText.trim() : ""
            if (!text) return

            flushBuffer(currentChapterTitle)

            items.push({
                id: `head-${idCounter++}`,
                type: 'header',
                content: text,
                chapter: text,
                bookTitle: bookTitle,
                creator: creator
            })

            currentChapterTitle = text
            return
        }
        /*
        // PARAGRAPH-LIKE BLOCKS: smart grouping
        if (['P', 'LI', 'BLOCKQUOTE'].includes(tagName)) {
            const text = node.innerText ? node.innerText.trim() : ""
            if (!text) return

            const dialogue = isDialogueLine(text)

            // If adding this would exceed HARD_LIMIT -> flush first
            if (buffer.text.length + text.length > HARD_LIMIT) {
                flushBuffer(currentChapterTitle)
            }

            appendToBuffer(text)

            // If it's a long paragraph and not dialogue -> flush immediately
            if (!dialogue && text.length >= MIN_PARAGRAPH_LENGTH) {
                flushBuffer(currentChapterTitle)
                return
            }

            // If we reached SOFT_LIMIT and it's not dialogue -> flush
            if (!dialogue && buffer.text.length >= SOFT_LIMIT) {
                flushBuffer(currentChapterTitle)
                return
            }

            // If we reached HARD_LIMIT -> flush always
            if (buffer.text.length >= HARD_LIMIT) {
                flushBuffer(currentChapterTitle)
            }

            return
        }
        */
        if (['P', 'LI', 'BLOCKQUOTE'].includes(tagName)) {
            const text = node.innerText ? node.innerText.trim() : ""
            if (!text) return

            const dialogue = isDialogueLine(text)

            // si esto rompe el hard limit, flush antes
            if (buffer.text.length + text.length > HARD_LIMIT) {
                flushBuffer(currentChapterTitle)
            }

            const hadBufferBefore = buffer.text.trim().length > 0

            appendToBuffer(text)

            // si entra un párrafo largo narrativo, que funcione como cierre del bloque
            if (!dialogue && text.length >= MIN_PARAGRAPH_LENGTH) {
                flushBuffer(currentChapterTitle)
                return
            }

            // soft limit: flush si no es diálogo
            if (!dialogue && buffer.text.length >= SOFT_LIMIT) {
                flushBuffer(currentChapterTitle)
                return
            }

            // hard limit: flush siempre
            if (buffer.text.length >= HARD_LIMIT) {
                flushBuffer(currentChapterTitle)
            }

            return
        }

        // CONTAINERS: recurse
        if (['DIV', 'SECTION', 'ARTICLE', 'BODY'].includes(tagName)) {
            if (node.children && node.children.length > 0) {
                Array.from(node.children).forEach(traverse)
            }
            return
        }

        // fallback recursion
        if (node.children && node.children.length > 0) {
            Array.from(node.children).forEach(traverse)
        }
    }


    // Spine items processing
    const itemsToProcess = spine.spineItems || []

    for (const item of itemsToProcess) {
        try {
            const doc = await item.load(book.load.bind(book))
            if (!doc) continue

            // Determine Chapter Title from TOC
            const tocItem = book.navigation.toc.find(t => t.href.includes(item.href))
            if (tocItem) {
                const newTitle = tocItem.label.trim()
                if (newTitle !== currentChapterTitle) {
                    flushBuffer(currentChapterTitle)
                    currentChapterTitle = newTitle
                }
            }

            const body = doc.body || doc.querySelector('body') || doc.documentElement
            if (body) traverse(body)

        } catch (e) {
            console.error("Error parsing spine item", item.href, e)
        }
    }

    flushBuffer(currentChapterTitle)


    // IMPORTANT: Only attach cover to metadata/first chunk to avoid massive size bloat
    if (items.length > 0 && coverUrl) {
        items[0].coverUrl = coverUrl
    }

    return items
}
