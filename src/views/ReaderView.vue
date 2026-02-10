<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookStore } from '../stores/bookStore'
import StickySidebar from '../components/StickySidebar.vue'
import Timeline from '../components/Timeline.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import { ArrowLeft } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useBookStore()

const bookId = route.params.id
const chunks = computed(() => store.currentBookChunks)
const bookMetadata = computed(() => store.currentBookMetadata)
const currentIndex = ref(0)
const timelineRef = ref(null)

const isBookLoaded = ref(false)

const tryInitialScroll = (retries = 0) => {
    if (timelineRef.value) {
        timelineRef.value.scrollToIndex(currentIndex.value)
    } else if (retries < 30) {
        setTimeout(() => tryInitialScroll(retries + 1), 50)
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
        }, 300) // Increased from nextTick/immediate to 300ms
    } catch (e) {
        console.error("Failed to load book", e)
        router.push('/')
    } finally {
    }
}

onMounted(loadBookData)

const onVisibleIndexChange = (index) => {
    if (index !== currentIndex.value) {
        currentIndex.value = index
        store.updateProgress(bookId, index)
    }
}

const toggleBookmark = (chunk) => {
    store.toggleBookmark(bookId, chunk.id)
}

const navigateToBookmark = (direction) => {
    const bookmarks = bookMetadata.value?.bookmarks || []
    
    const sortedBookmarks = bookmarks
        .map(id => ({ id, index: chunks.value.findIndex(item => item.id === id) }))
        .filter(b => b.index !== -1)
        .sort((a, b) => a.index - b.index)



    // sortedBookmarks is already declared/calculated above
    if (sortedBookmarks.length === 0) {
        // Fallback to start/end if no bookmarks
        if (direction === 'prev' && currentIndex.value > 0) {
            scrollTo(0)
        }
        return
    }

    let targetIndex = -1
    if (direction === 'next') {
        const next = sortedBookmarks.find(b => b.index > currentIndex.value)
        if (next) targetIndex = next.index
    } else {
        // When going prev, we look for anything less than current index
        const prev = [...sortedBookmarks].reverse().find(b => b.index < currentIndex.value)
        if (prev) targetIndex = prev.index
        else if (currentIndex.value > 0) targetIndex = 0 // Go to start if no bookmarks before
    }

    if (targetIndex !== -1) {
        scrollTo(targetIndex)
    }
}

const scrollTo = (index) => {
    currentIndex.value = index
    store.updateProgress(bookId, index)
    timelineRef.value?.scrollToIndex(index)
}
</script>

<template>
    <div class="min-h-screen bg-black text-white flex justify-center selection:bg-blue-500/30">
        <!-- Persistent Sidebar -->
        <StickySidebar 
            :current-index="currentIndex"
            :total-chunks="chunks.length"
            @navigate-bookmark="navigateToBookmark"
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

        <main class="w-full max-w-[650px] border-x border-gray-800 min-h-screen relative flex flex-col">
            <!-- Loading Overlay -->
            <!-- Loading Overlay -->
            <LoadingSpinner 
                v-if="store.loading" 
                fullscreen 
                message="Loading Book..." 
                sub-message="Tip: If this takes too long, re-adding the book will skip slow image processing."
            />

            <!-- Header -->
            <header class="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex items-center justify-between">
               <div class="flex items-center gap-4">
                   <button @click="router.push('/')" class="lg:hidden p-2 hover:bg-gray-800 rounded-full">
                       <ArrowLeft class="w-5 h-5" />
                   </button>
                   <div>
                       <h1 class="font-bold text-lg leading-none lg:line-clamp-1">{{ bookMetadata?.title }}</h1>
                       <span class="text-[10px] text-gray-500 font-mono uppercase mt-1 block">
                           {{ chunks[currentIndex]?.chapter || 'Chapter' }}
                       </span>
                   </div>
               </div>
               
               <div class="flex items-center gap-6">
                   <div class="flex flex-col items-end">
                       <span class="text-[10px] text-gray-500 font-mono uppercase">Progress</span>
                       <span class="text-sm font-bold text-blue-500">{{ Math.min(100, Math.round(((currentIndex + 1) / chunks.length) * 100)) }}%</span>
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
                @index-change="onVisibleIndexChange"
                @toggle-bookmark="toggleBookmark"
            />
        </main>
    </div>
</template>
