import { openDB } from 'idb';

const DB_NAME = 'DoomReaderDB';
const DB_VERSION = 3;
const BOOKS_STORE = 'books'; // Stores large book data (chunks)
const IMAGES_STORE = 'images'; // Stores book images

let dbPromise = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(BOOKS_STORE)) {
                    db.createObjectStore(BOOKS_STORE);
                }
                if (!db.objectStoreNames.contains('covers')) {
                    db.createObjectStore('covers');
                }
                if (!db.objectStoreNames.contains(IMAGES_STORE)) {
                    db.createObjectStore(IMAGES_STORE);
                }
            },
        });
    }
    return dbPromise;
}

/**
 * Shelf Metadata (Stored in LocalStorage for simplicity and speed)
 * Structure: { id, title, creator, coverUrl, lastReadIndex, bookmarks: [], order }
 */
const SHELF_KEY = 'doomreader-shelf';

export const storageService = {
    // --- Shelf Management ---
    getShelf() {
        const shelf = localStorage.getItem(SHELF_KEY);
        return shelf ? JSON.parse(shelf) : [];
    },

    saveShelf(shelf) {
        localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
    },

    async addBook(metadata, chunks) {
        const shelf = this.getShelf();
        const bookId = crypto.randomUUID();

        // Don't store full coverUrl in localStorage to avoid QuotaExceededError
        const newBook = {
            id: bookId,
            title: metadata.title,
            creator: metadata.creator || 'Unknown Author',
            totalChunks: metadata.totalChunks || chunks.length,
            lastReadIndex: 0,
            bookmarks: [],
            order: shelf.length,
            addedAt: new Date().toISOString()
        };

        shelf.push(newBook);
        this.saveShelf(shelf);

        // Save chunks and cover to IndexedDB
        const db = await getDB();
        await db.put(BOOKS_STORE, chunks, bookId);
        if (metadata.coverUrl) {
            await db.put('covers', metadata.coverUrl, bookId);
        }

        return bookId;
    },

    async getBookCover(bookId) {
        try {
            const db = await getDB();
            return await db.get('covers', bookId);
        } catch (e) {
            return null;
        }
    },

    async getBookChunks(bookId) {
        const db = await getDB();
        return await db.get(BOOKS_STORE, bookId);
    },

    async removeBook(bookId) {
        const shelf = this.getShelf().filter(b => b.id !== bookId);
        this.saveShelf(shelf);

        const db = await getDB();
        await db.delete(BOOKS_STORE, bookId);
        await db.delete('covers', bookId);
    },

    updateBookMetadata(bookId, updates) {
        const shelf = this.getShelf();
        const index = shelf.findIndex(b => b.id === bookId);
        if (index !== -1) {
            shelf[index] = { ...shelf[index], ...updates };
            this.saveShelf(shelf);
        } else {
            console.warn(`Storage: Book not found for metadata update ${bookId}`);
        }
    },

    // --- Image Management ---
    async saveImage(bookId, path, blob) {
        const db = await getDB();
        const key = `${bookId}|${path}`;
        await db.put(IMAGES_STORE, blob, key);
    },

    async getImage(bookId, path) {
        try {
            const db = await getDB();
            const key = `${bookId}|${path}`;
            return await db.get(IMAGES_STORE, key);
        } catch (e) {
            return null;
        }
    },

    // --- Bookmarking ---
    toggleBookmark(bookId, chunkId) {
        const shelf = this.getShelf();
        const book = shelf.find(b => b.id === bookId);
        if (book) {
            if (!book.bookmarks) book.bookmarks = [];

            // Robust toggle with Set to prevent any possibility of duplicates
            const bookmarkSet = new Set(book.bookmarks);

            if (bookmarkSet.has(chunkId)) {
                bookmarkSet.delete(chunkId);
            } else {
                bookmarkSet.add(chunkId);
            }

            book.bookmarks = Array.from(bookmarkSet);
            this.saveShelf(shelf);
            return book.bookmarks;
        }
        return [];
    }
};
