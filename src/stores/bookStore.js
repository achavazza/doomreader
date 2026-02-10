import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { storageService } from '../services/storageService'
import { parseBook } from '../services/parserService'

export const useBookStore = defineStore('book', () => {
    const shelf = shallowRef([])
    const currentBookChunks = shallowRef([])
    const currentBookMetadata = ref(null)
    const loading = ref(false)
    const covers = ref({}) // Map of bookId -> coverUrl

    const sortedShelf = computed(() => {
        return [...shelf.value].sort((a, b) => a.order - b.order)
    })

    const loadShelf = async () => {
        const list = storageService.getShelf()
        shelf.value = list

        // Background load covers
        for (const book of list) {
            if (!covers.value[book.id]) {
                storageService.getBookCover(book.id).then(url => {
                    if (url) covers.value[book.id] = url
                })
            }
        }
    }

    const addBook = async (file) => {
        loading.value = true
        try {
            const chunks = await parseBook(file)
            const metadata = {
                title: chunks[0]?.bookTitle || file.name,
                creator: chunks[0]?.creator || 'Unknown Author',
                coverUrl: chunks[0]?.coverUrl || null,
                totalChunks: chunks.length
            }
            const bookId = await storageService.addBook(metadata, chunks)
            await loadShelf()
            return bookId
        } catch (e) {
            console.error("Store: Failed to add book", e)
            throw e
        } finally {
            loading.value = false
        }
    }

    const removeBook = async (id) => {
        await storageService.removeBook(id)
        await loadShelf()
    }

    const moveBook = async (id, direction) => {
        const index = shelf.value.findIndex(b => b.id === id)
        if (index === -1) return

        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= shelf.value.length) return

        // Swap order property
        const temp = shelf.value[index].order
        shelf.value[index].order = shelf.value[newIndex].order
        shelf.value[newIndex].order = temp

        storageService.saveShelf(shelf.value)
        await loadShelf()
    }

    const loadBook = async (bookId) => {
        loading.value = true
        try {
            // Find in shelf first (reactive)
            let meta = shelf.value.find(b => b.id === bookId)

            if (!meta) {
                await loadShelf()
                meta = shelf.value.find(b => b.id === bookId)
            }

            if (!meta) throw new Error("Book not found")
            currentBookMetadata.value = meta

            const chunks = await storageService.getBookChunks(bookId)

            currentBookChunks.value = chunks || []

            return { meta, chunks }
        } catch (e) {
            console.error("Store: Failed to load book", e)
            throw e
        } finally {
            loading.value = false
        }
    }

    const updateProgress = (bookId, index) => {
        // Update both local metadata and shelf item for reactivity
        if (currentBookMetadata.value && currentBookMetadata.value.id === bookId) {
            currentBookMetadata.value.lastReadIndex = index
        }

        // Since shelf is shallowRef, we need to trigger a fresh assignment if we want reactivity on individual items in the shelf view, 
        // but for ReaderView, we just need the local metadata to be updated.
        // For the shelf bar to update, we'd need: shelf.value = [...shelf.value]
        const idx = shelf.value.findIndex(b => b.id === bookId)
        if (idx !== -1) {
            const newShelf = [...shelf.value]
            newShelf[idx] = { ...newShelf[idx], lastReadIndex: index }
            shelf.value = newShelf
        }

        storageService.updateBookMetadata(bookId, { lastReadIndex: index })
    }

    const toggleBookmark = (bookId, chunkId) => {
        const newBookmarks = storageService.toggleBookmark(bookId, chunkId)
        if (currentBookMetadata.value && currentBookMetadata.value.id === bookId) {
            currentBookMetadata.value.bookmarks = newBookmarks
        }

        const idx = shelf.value.findIndex(b => b.id === bookId)
        if (idx !== -1) {
            const newShelf = [...shelf.value]
            newShelf[idx] = { ...newShelf[idx], bookmarks: newBookmarks }
            shelf.value = newShelf
        }
        return newBookmarks
    }

    return {
        shelf,
        sortedShelf,
        currentBookChunks,
        currentBookMetadata,
        loading,
        covers,
        loadShelf,
        addBook,
        removeBook,
        moveBook,
        loadBook,
        updateProgress,
        toggleBookmark
    }
})
