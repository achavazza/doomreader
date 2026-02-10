<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '../stores/bookStore'
import { Trash2, Book as BookIcon, ChevronUp, ChevronDown, Plus } from 'lucide-vue-next'
import ShelfSidebar from '../components/ShelfSidebar.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'

const router = useRouter()
const store = useBookStore()

onMounted(() => {
    store.loadShelf()
})

const handleAddBook = async (file) => {
    if (file) {
        try {
            await store.addBook(file)
            // Optional: Auto-open?
            // router.push(`/reader/${bookId}`)
        } catch (e) {
            alert("Error adding book: " + e.message)
        }
    }
}

// Mobile/Fallback file upload handler
const handleFileUpload = (event) => {
    const file = event.target.files[0]
    handleAddBook(file)
}

const openBook = (id) => {
    router.push(`/reader/${id}`)
}

const deleteBook = (id, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this book?')) {
        store.removeBook(id)
    }
}

const moveBook = (id, direction, e) => {
    e.stopPropagation()
    store.moveBook(id, direction)
}
</script>

<template>
    <div class="min-h-screen bg-black text-white flex justify-center selection:bg-blue-500/30">
        <!-- New Sidebar -->
        <ShelfSidebar @add-book="handleAddBook" />

        <main class="w-full max-w-[1200px] border-x border-gray-800 min-h-screen relative flex flex-col">
            
            <!-- Mobile Header / Top Bar for non-sidebar views -->
            <!-- We keep this visible on mobile (lg:hidden) and maybe tweak looking for desktop -->
            <header class="lg:hidden sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <h1 class="font-bold text-lg tracking-tighter flex items-center gap-2">
                        <img src="/favicon.png" alt="Logo" class="w-6 h-6" />
                        doomreader
                </h1>
                <label class="p-2 bg-white text-black rounded-lg cursor-pointer">
                    <Plus class="w-5 h-5" />
                    <input type="file" accept=".epub,.docx,.doc" class="hidden" @change="handleFileUpload" :disabled="store.loading">
                </label>
            </header>

            <div class="p-8">
                <!-- Header content for the main area (Title context) -->
                <div class="mb-8 flex items-end justify-between">
                     <div>
                        <h2 class="font-bold text-2xl mb-1">My Collection</h2>
                        <p class="text-gray-500 text-sm">Sorted by your preference</p>
                     </div>
                </div>

                <LoadingSpinner 
                    v-if="store.loading" 
                    message="Analyzing and storing your book..." 
                />

                <label 
                    v-else-if="store.shelf.length === 0" 
                    class="flex flex-col items-center justify-center p-20 border-2 border-dashed border-gray-800 rounded-3xl mt-10 hover:border-gray-600 hover:bg-gray-900/30 transition cursor-pointer group"
                >
                     <input type="file" accept=".epub,.docx,.doc" class="hidden" @change="handleFileUpload" :disabled="store.loading">
                     <BookIcon class="w-16 h-16 text-gray-700 mb-4 group-hover:text-blue-500 transition-colors" />
                     <h2 class="text-2xl font-bold mb-2 text-gray-200 group-hover:text-white transition">Shelf is Empty</h2>
                     <p class="text-gray-500 mb-8 max-w-sm text-center group-hover:text-gray-400 transition">Start by adding your first book to the collection.</p>
                     
                     <div class="flex items-center gap-2 bg-white text-black group-hover:bg-gray-200 font-bold py-3 px-6 rounded-full transition transform group-hover:scale-105 shadow-lg">
                        <Plus class="w-5 h-5" />
                        <span>Add Book Now</span>
                    </div>
                </label>

                <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <div 
                        v-for="book in store.sortedShelf" 
                        :key="book.id"
                        @click="openBook(book.id)"
                        class="group relative cursor-pointer"
                    >
                        <div class="aspect-[2/3] bg-gray-900 rounded-xl overflow-hidden mb-3 border border-gray-800 group-hover:border-gray-500 transition shadow-lg group-hover:shadow-blue-500/10">
                            <img v-if="store.covers[book.id]" :src="store.covers[book.id]" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                            <div v-else class="w-full h-full flex items-center justify-center text-gray-700">
                                <BookIcon class="w-12 h-12" />
                            </div>
                            
                            <!-- Overlay Actions -->
                            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                 <button @click="moveBook(book.id, 'up', $event)" class="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition" title="Move Up">
                                    <ChevronUp class="w-4 h-4" />
                                 </button>
                                 <button @click="moveBook(book.id, 'down', $event)" class="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition" title="Move Down">
                                    <ChevronDown class="w-4 h-4" />
                                 </button>
                                 <button @click="deleteBook(book.id, $event)" class="p-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition ml-2" title="Delete">
                                    <Trash2 class="w-4 h-4" />
                                 </button>
                            </div>
                        </div>
                        <h3 class="font-bold text-sm line-clamp-2 leading-tight">{{ book.title }}</h3>
                        <p class="text-xs text-gray-500 mt-1 line-clamp-1">{{ book.creator }}</p>
                        <div v-if="book.totalChunks || book.lastReadIndex > 0" class="mt-2 w-full bg-gray-900 h-1 rounded-full overflow-hidden">
                             <div 
                                class="bg-blue-500 h-full transition-all duration-500" 
                                :style="{ width: book.totalChunks ? Math.min(100, Math.round(((book.lastReadIndex + 1) / book.totalChunks) * 100)) + '%' : '30%' }"
                             ></div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
