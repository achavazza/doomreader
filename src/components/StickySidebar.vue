<script setup>
import { BookOpen, User, ChevronUp, ChevronDown, Bookmark } from 'lucide-vue-next'
import { computed } from 'vue'
import { useBookStore } from '../stores/bookStore'

const props = defineProps({
    currentIndex: {
        type: Number,
        default: 0
    },
    totalChunks: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits(['navigate-bookmark'])
const store = useBookStore()

const metadata = computed(() => store.currentBookMetadata || {})
const coverUrl = computed(() => store.covers[metadata.value.id] || null)

const bookmarksCount = computed(() => {
    const bookmarks = metadata.value.bookmarks || []
    const chunkIds = new Set(store.currentBookChunks.map(c => c.id))
    return bookmarks.filter(id => chunkIds.has(id)).length
})

const progressPercentage = computed(() => {
    if (props.totalChunks === 0) return 0
    return Math.min(100, Math.round(((props.currentIndex + 1) / props.totalChunks) * 100))
})

const sortedBookmarkIndices = computed(() => {
    const bookmarks = metadata.value.bookmarks || []
    const chunkIds = new Set(store.currentBookChunks.map(c => c.id))
    return bookmarks
        .filter(id => chunkIds.has(id))
        .map(id => store.currentBookChunks.findIndex(c => c.id === id))
        .filter(idx => idx !== -1)
        .sort((a, b) => a - b)
})

const canGoPrev = computed(() => {
    // Only enabled if there is a bookmark BEFORE the current chunk
    return sortedBookmarkIndices.value.some(idx => idx < props.currentIndex)
})

const canGoNext = computed(() => {
    // Only enabled if there is a bookmark AFTER the current chunk
    return sortedBookmarkIndices.value.some(idx => idx > props.currentIndex)
})
</script>

<template>
  <aside class="w-[300px] h-screen sticky top-0 hidden lg:flex flex-col p-8 border-r border-gray-800">
      <!-- Logo / Brand -->
      <div class="mb-12">
          <slot name="top" />
          <h1 class="text-2xl font-bold tracking-tighter flex items-center gap-2">
                <img src="/favicon.png" alt="Logo" class="w-8 h-8" style="vertical-align: middle;"/>
                doomreader
          </h1>
      </div>

      <!-- Book Cover -->
      <div class="w-full aspect-[2/3] bg-gray-800 rounded-lg shadow-2xl overflow-hidden mb-6 border border-gray-700 relative group flex-shrink-0">
          <img v-if="coverUrl" :src="coverUrl" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div v-else class="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
              <BookOpen class="w-12 h-12 opacity-50" />
              <span class="text-sm">No Book Loaded</span>
          </div>
      </div>

      <!-- Book Info -->
      <div v-if="metadata.title" class="space-y-4 mb-auto">
          <div>
            <h2 class="text-xl font-bold text-white leading-tight mb-1">{{ metadata.title }}</h2>
            <div class="flex items-center gap-2 text-gray-400 text-sm">
                <User class="w-4 h-4" />
                <span>{{ metadata.creator || 'Unknown Author' }}</span>
            </div>
          </div>

          <!-- Progress -->
          <div class="space-y-2">
               <div class="flex justify-between text-xs text-gray-400 uppercase tracking-wide">
                   <span>Progress</span>
                   <span>{{ progressPercentage }}%</span>
               </div>
               <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                   <div class="h-full bg-white transition-all duration-300" :style="{ width: progressPercentage + '%' }"></div>
               </div>
               <div class="text-xs text-gray-600 text-right">
                   {{ currentIndex + 1 }} / {{ totalChunks }} chunks
               </div>
          </div>

          <!-- Bookmarks Navigation -->
          <div v-if="bookmarksCount > 0" class="pt-6 border-t border-gray-900 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <div class="flex items-center justify-between mb-3 text-xs text-gray-500 uppercase tracking-widest font-bold">
                    <span class="flex items-center gap-2">
                        <Bookmark class="w-3 h-3 fill-white text-white" />
                        Bookmarks
                    </span>
                    <span class="bg-gray-900 px-2 py-0.5 rounded text-white">{{ bookmarksCount }}</span>
               </div>
               
                <div class="flex gap-2">
                     <button 
                         @click="emit('navigate-bookmark', 'prev')"
                         :disabled="!canGoPrev"
                         class="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-900 py-3 rounded-xl transition text-sm font-medium border border-gray-800 hover:border-gray-700"
                     >
                         <ChevronUp class="w-4 h-4" />
                         <span>Prev</span>
                     </button>
                     <button 
                         @click="emit('navigate-bookmark', 'next')"
                         :disabled="!canGoNext"
                          class="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-900 py-3 rounded-xl transition text-sm font-medium border border-gray-800 hover:border-gray-700"
                     >
                         <span>Next</span>
                         <ChevronDown class="w-4 h-4" />
                     </button>
                </div>
          </div>
      </div>
  </aside>
</template>
