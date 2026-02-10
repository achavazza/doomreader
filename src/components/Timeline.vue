<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import BookCard from './BookCard.vue'

const props = defineProps({
  chunks: {
    type: Array,
    required: true
  },
  bookmarks: {
    type: Array,
    default: () => ([])
  },
  initialIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['index-change', 'toggle-bookmark'])

const scroller = ref(null)
const HEADER_OFFSET = 80 // Threshold for a chunk to be considered "read" or "on top"
const BOTTOM_OFFSET = 300 // For detecting progress near bottom
const isProgrammaticScroll = ref(false)
const isReady = ref(false)
let scrollPauseTimeout = null

const attemptRefinement = (targetIndex, attempts = 0) => {
    const el = document.querySelector(`.chunk-card-wrapper[data-index="${targetIndex}"]`)
    if (el) {
        const rect = el.getBoundingClientRect()
        const currentTop = rect.top + window.scrollY
        const targetTop = currentTop - HEADER_OFFSET
        
        if (Math.abs(rect.top - HEADER_OFFSET) > 5) {
                window.scrollTo({ top: targetTop, behavior: 'auto' })
        }
        
        // Success! Unlock after short delay
        setTimeout(() => { 
            isProgrammaticScroll.value = false 
            isReady.value = true
        }, 100)
    } else if (attempts < 5) {
        // Retry logic
        setTimeout(() => attemptRefinement(targetIndex, attempts + 1), 200)
    } else {
        // Give up, but enable observer so user can at least scroll manually
        isProgrammaticScroll.value = false
        isReady.value = true
    }
}

const scrollToIndex = (index, retryCount = 0) => {
    // If scroller ref isn't ready, wait and retry
    if (!scroller.value) {
        if (retryCount < 20) {
            setTimeout(() => scrollToIndex(index, retryCount + 1), 50)
            return
        }
        // Emergency unlock so user isn't stuck
        isReady.value = true
        return
    }
    
    try {
        if (scrollPauseTimeout) clearTimeout(scrollPauseTimeout)
        isProgrammaticScroll.value = true
        
        const targetIndex = parseInt(index)

        // 1. Initial Jump (Estimate)
        const estimate = targetIndex * 300 
        window.scrollTo({ top: estimate, behavior: 'auto' })

        // 2. Library Jump
        if (scroller.value && scroller.value.scrollToItem) {
            scroller.value.scrollToItem(targetIndex)
        }
        
        // 3. Start Refinement Loop (Delayed)
        setTimeout(() => attemptRefinement(targetIndex), 500)

        // Safety unlock fallback
        scrollPauseTimeout = setTimeout(() => {
            if (isProgrammaticScroll.value) {
                console.log("NavDebug: Safety unlock")
                isProgrammaticScroll.value = false
                isReady.value = true
            }
        }, 3000) // Increased safety timeout
    } catch (err) {
        console.error("Timeline: Navigation failed", err)
        isProgrammaticScroll.value = false
        isReady.value = true
    }
}

// User interaction breaks the lock
const unlock = () => {
    if (isProgrammaticScroll.value || !isReady.value) {
        isProgrammaticScroll.value = false
        isReady.value = true
    }
}

onMounted(() => {
    // Prevent browser from restoring scroll position, we handle it manually
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
    }

    // If starting at 0, we are ready immediately. 
    // If starting elsewhere, ReaderView calls scrollToIndex which sets isReady=true when done.
    if (props.initialIndex === 0) {
        isReady.value = true
    }

    setupObserver()
    window.addEventListener('wheel', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    window.addEventListener('mousedown', unlock, { passive: true })
})

onUnmounted(() => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
    }
    window.removeEventListener('wheel', unlock)
    window.removeEventListener('touchstart', unlock)
    window.removeEventListener('mousedown', unlock)
})

defineExpose({ scrollToIndex })

let observer = null

const setupObserver = () => {
    if (observer) observer.disconnect()

    // IntersectionObserver to detect which chunk is currently visible at the top
    observer = new IntersectionObserver((entries) => {
        if (isProgrammaticScroll.value || !isReady.value) return 
        
        // We want the chunk that is at the top of the viewport
        let bestCandidate = null
        let minDistance = Infinity

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const rect = entry.target.getBoundingClientRect()
                // Distance to the "active reading line" (HEADER_OFFSET)
                const distance = Math.abs(rect.top - HEADER_OFFSET)
                
                // If it's near the top or overlapping the header, it's a candidate
                if (rect.top < window.innerHeight * 0.5) {
                    if (distance < minDistance) {
                        minDistance = distance
                        bestCandidate = entry.target
                    }
                }
            }
        })

        if (bestCandidate) {
            const index = bestCandidate.getAttribute('data-index')
            if (index !== null) {
                const idx = parseInt(index)
                if (idx === 0 && !isReady.value) {
                     return
                }
                
                emit('index-change', idx)
            }
        }
    }, {
        root: null,
        rootMargin: `0px 0px -50% 0px`, // Detect in the top half
        threshold: [0, 0.1, 0.2]
    })

    // Observe all currently rendered chunks
    // Since we use a virtual scroller, we need to re-observe when items are rendered
}

const onVisibleUpdate = () => {
    // This is called by DynamicScroller when visible items change
    // Re-observe elements
    const elements = document.querySelectorAll('.chunk-card-wrapper')
    elements.forEach(el => observer?.observe(el))
}



watch(() => props.chunks, () => {
    // Reset observer if items change dramatically
    setupObserver()
}, { deep: false })

</script>

<template>
  <div class="w-full">
    <DynamicScroller
      ref="scroller"
      :items="chunks"
      :min-item-size="100"
      class="w-full"
      key-field="id"
      page-mode
      @visible="onVisibleUpdate"
    >
      <template v-slot="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :data-index="index"
          :size-dependencies="[
            item.content,
            item.src
          ]"
          class="chunk-card-wrapper"
        >
          <BookCard 
            :item="item" 
            :index="index"
            :is-bookmarked="bookmarks.includes(item.id)"
            class="chunk-card"
            @bookmark="emit('toggle-bookmark', $event)"
          />
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>
