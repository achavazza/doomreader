<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookStore } from '../stores/bookStore'
import StickySidebar from '../components/StickySidebar.vue'
import Timeline from '../components/Timeline.vue'
import { CONFIG } from '../config'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import { ArrowLeft, ChevronUp, ChevronDown, Bookmark, List, Settings } from 'lucide-vue-next'
import CustomScrollbar from '../components/CustomScrollbar.vue'

const route = useRoute()
const router = useRouter()
const store = useBookStore()

const bookId = route.params.id
const chunks = computed(() => store.currentBookChunks)
const bookMetadata = computed(() => store.currentBookMetadata)
const currentIndex = ref(0)
const timelineRef = ref(null)

const isBookLoaded = ref(false)
const initialScrollComplete = ref(false)
const isNavigating = ref(false)
const isInitializing = ref(true)
const debugMode = ref(CONFIG.DEBUG_MODE)

const initialScrollStarted = ref(false)
const tryInitialScroll = async (retries = 0) => {
    if (initialScrollStarted.value) return
    if (timelineRef.value) {
        initialScrollStarted.value = true
        isNavigating.value = true
        if (debugMode.value) { console.log(`Reader: Starting initial scroll to ${currentIndex.value}`) }
        await timelineRef.value.scrollToIndex(currentIndex.value)
        initialScrollComplete.value = true
        isInitializing.value = false
        isNavigating.value = false
        if (debugMode.value) { console.log("Reader: Initial scroll complete") }
    } else if (retries < 30) {
        setTimeout(() => tryInitialScroll(retries + 1), 50)
    } else {
        initialScrollComplete.value = true
        isInitializing.value = false
    }
}

const loadBookData = async () => {
    try {
        await store.loadBook(bookId)
        
        if (store.currentBookMetadata) {
            currentIndex.value = store.currentBookMetadata.lastReadIndex || 0
        }
        
        // Use a slight delay to ensure child components are ready
        isBookLoaded.value = true
        
        // Wait for Vue to render Timeline and for VirtualScroller to calculate height
        setTimeout(() => {
            tryInitialScroll()
        }, 500) 
    } catch (e) {
        console.error("Failed to load book", e)
        router.push('/')
    } finally {
    }
}

// Keyboard navigation handler
const handleKeydown = (e) => {
    if (!CONFIG.KEYBOARD_NAVIGATION) return
    if (!initialScrollComplete.value || isNavigating.value) return
    
    if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentIndex.value > 0) {
            scrollTo(currentIndex.value - 1)
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentIndex.value < chunks.value.length - 1) {
            scrollTo(currentIndex.value + 1)
        }
    }
}

onMounted(() => {
    loadBookData()
    if (CONFIG.KEYBOARD_NAVIGATION) {
        window.addEventListener('keydown', handleKeydown)
    }
})

onUnmounted(() => {
    if (CONFIG.KEYBOARD_NAVIGATION) {
        window.removeEventListener('keydown', handleKeydown)
    }
})

const onVisibleIndexChange = (index) => {
    // Only update state if we are done with the initial scroll dance and NOT navigating
    if (!initialScrollComplete.value || isNavigating.value) return

    if (index !== currentIndex.value) {
        currentIndex.value = index
        store.updateProgress(bookId, index)
    }
}

const toggleBookmark = (chunkOrId) => {
    let id = null
    if (chunkOrId && typeof chunkOrId === 'object' && chunkOrId.id) {
        id = chunkOrId.id
    } else if (typeof chunkOrId === 'string') {
        id = chunkOrId
    } else {
        // Use currentIndex, but if we are navigating, we should probably 
        // bookmark what we are looking for, not where we are drifting from.
        id = chunks.value[currentIndex.value]?.id
    }

    if (id) {
        store.toggleBookmark(bookId, id)
    }
}

const isCurrentBookmarked = computed(() => {
    if (!chunks.value[currentIndex.value]) return false
    const id = chunks.value[currentIndex.value].id
    return bookMetadata.value?.bookmarks?.includes(id) || false
})

const bookmarksCount = computed(() => {
    if (!bookMetadata.value?.bookmarks) return 0
    // Filter bookmarks that actually exist in current chunks (in case of stale IDs)
    const chunkIds = new Set(chunks.value.map(c => c.id))
    return bookMetadata.value.bookmarks.filter(id => chunkIds.has(id)).length
})

// Computed properties for reliable navigation
const sortedBookmarks = computed(() => {
    const bookmarks = bookMetadata.value?.bookmarks || []
    return bookmarks
        .map(id => ({ id, index: chunks.value.findIndex(item => item.id === id) }))
        .filter(b => b.index !== -1)
        .sort((a, b) => a.index - b.index)
})

const prevBookmarkIndex = computed(() => {
    // Find closest bookmark with index < currentIndex
    const reversed = [...sortedBookmarks.value].reverse()
    const found = reversed.find(b => b.index < currentIndex.value)
    return found ? found.index : null
})

const nextBookmarkIndex = computed(() => {
    // Find closest bookmark with index > currentIndex
    const found = sortedBookmarks.value.find(b => b.index > currentIndex.value)
    return found ? found.index : null
})

const navigateToBookmark = (direction) => {
    let target = null
    if (direction === 'prev') target = prevBookmarkIndex.value
    if (direction === 'next') target = nextBookmarkIndex.value

    if (target !== null) {
        if (debugMode.value) {
            console.log(`Reader: Navigating to bookmark at index ${target} (direction: ${direction})`)
        }
        scrollTo(target)
    }
}

const scrollTo = async (index) => {
    isNavigating.value = true
    currentIndex.value = index
    store.updateProgress(bookId, index)
    if (timelineRef.value) {
        await timelineRef.value.scrollToIndex(index)
    }
    isNavigating.value = false
}
</script>

<template>
    <div class="h-screen bg-black text-white flex justify-center selection:bg-blue-500/30 overflow-hidden"> <!-- VList scroll layout -->
        <!-- Persistent Sidebar -->
        <StickySidebar 
            :current-index="currentIndex"
            :total-chunks="chunks.length"
            @navigate-bookmark="navigateToBookmark"
            class="hidden lg:block"
        >
            <template #top>
                <button 
                  @click="router.push('/')"
                  class="flex items-center gap-2 text-gray-500 hover:text-white transition group mb-8"
                >
                  <ArrowLeft class="w-4 h-4 group-hover:-translate-x-1 transition" />
                  <span class="text-sm font-medium">Back to Shelf</span>
                </button>
            </template>
        </StickySidebar>

        <div class="w-full max-w-[650px] border-x border-gray-800 relative">
            <!-- Loading Overlay -->
            <LoadingSpinner 
                v-if="store.loading || isInitializing" 
                fullscreen 
                :message="isInitializing ? 'Preparing scroller...' : 'Loading Book...'" 
                sub-message="Tip: If this takes too long, re-adding the book will skip slow image processing."
            />

            <!-- Header (Mobile Only Back Button + Title) -->
            <header class="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex items-center justify-between">
               <div class="flex items-center gap-4">
                   <button @click="router.push('/')" class="p-2 hover:bg-gray-800 rounded-full transition">
                       <ArrowLeft class="w-5 h-5" />
                   </button>
                   <div>
                       <h1 class="font-bold text-lg leading-none line-clamp-1">{{ bookMetadata?.title }}</h1>
                       <span class="text-[10px] text-gray-500 font-mono uppercase mt-1 block">
                           {{ chunks[currentIndex]?.chapter || 'Chapter' }}
                       </span>
                   </div>
               </div>
            </header>

            <!-- Book Content -->
            <Timeline 
                v-if="chunks.length > 0 && isBookLoaded"
                ref="timelineRef"
                :chunks="chunks" 
                :initial-index="currentIndex"
                :bookmarks="bookMetadata?.bookmarks || []"
                :debug-mode="debugMode"
                @index-change="onVisibleIndexChange"
                @toggle-bookmark="toggleBookmark"
            />
        </div>

        <!-- New Mobile/Fixed Footer -->
        <div class="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-gray-800 px-4 pt-3 pb-2 flex lg:hidden flex-col gap-2 shadow-2xl">
            <!-- Progress Bar -->
            <div class="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div 
                    class="h-full bg-blue-500 transition-all duration-300 ease-out"
                    :style="{ width: `${Math.min(100, ((currentIndex + 1) / (chunks.length || 1)) * 100)}%` }"
                ></div>
            </div>

            <!-- Controls -->
            <div class="flex items-center justify-between mt-1">
                 <!-- Left: Stats -->
                 <div class="text-[10px] font-mono text-gray-500 min-w-[60px]">
                    <span class="text-white font-bold">{{ currentIndex + 1 }}</span> / {{ chunks.length }}
                 </div>

                 <!-- Center: Bookmark Nav -->
                 <div class="flex items-center gap-3">
                    <button 
                        @click="navigateToBookmark('prev')"
                        :disabled="prevBookmarkIndex === null || isNavigating"
                        class="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition active:scale-95 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                        aria-label="Previous Bookmark"
                    >
                        <ChevronUp class="w-6 h-6" />
                    </button>
                    
                    <button 
                        @click="toggleBookmark()"
                        class="p-3 rounded-full transition active:scale-95 border border-gray-700 bg-gray-900/50"
                        :class="isCurrentBookmarked ? 'text-yellow-400 border-yellow-400' : 'text-gray-400 hover:text-white'"
                        aria-label="Toggle Bookmark"
                    >
                        <Bookmark class="w-6 h-6" :fill="isCurrentBookmarked ? 'currentColor' : 'none'" />
                    </button>

                    <button 
                        @click="navigateToBookmark('next')"
                        :disabled="nextBookmarkIndex === null || isNavigating"
                        class="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition active:scale-95 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                        aria-label="Next Bookmark"
                    >
                        <ChevronDown class="w-6 h-6" />
                    </button>
                 </div>

                 <!-- Right: Bookmarks Count -->
                 <div class="min-w-[60px] flex items-center justify-end gap-1.5 text-gray-400">
                     <Bookmark class="w-3 h-3" />
                     <span class="text-xs font-mono">{{ bookmarksCount }}</span>
                 </div>
             </div>
         </div>
     </div>
 
     <!-- Custom Scrollbar (Desktop Only) -->
     <CustomScrollbar
         :current-index="currentIndex"
         :total-chunks="chunks.length"
         @scroll-to-index="scrollTo"
     />
 </template>
 
 <style scoped>
 /* VList with custom scrollbar */
 </style>
