<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { VList } from 'virtua/vue'
import BookCard from './BookCard.vue'
import { CONFIG } from '../config'

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
  },
  debugMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['index-change', 'toggle-bookmark', 'scroll-complete'])

const scroller = ref(null)
const HEADER_OFFSET = CONFIG.HEADER_OFFSET
const isProgrammaticScroll = ref(false)
const isReady = ref(false)
let currentScrollId = 0
let scrollPauseTimeout = null

const scrollToIndex = async (index, retryCount = 0) => {
    if (!scroller.value) {
        if (retryCount < 20) {
            return new Promise(resolve => setTimeout(() => scrollToIndex(index, retryCount + 1).then(resolve), 50))
        }
        isReady.value = true
        emit('scroll-complete')
        return Promise.resolve(false)
    }

    try {
        if (scrollPauseTimeout) clearTimeout(scrollPauseTimeout)
        isProgrammaticScroll.value = true
        
        const scrollId = ++currentScrollId
        const targetIndex = parseInt(index)
        
        if (isNaN(targetIndex)) {
            isProgrammaticScroll.value = false
            return Promise.resolve(false)
        }
        if(props.debugMode){
            console.log(`Timeline: Navigating to chunk ${targetIndex} (Virtua VList)`)
        }
        return new Promise(async (resolve) => {
            // WindowVirtualizer scrolls to the item
            scroller.value.scrollToIndex(targetIndex, { align: 'start' })

            // Wait a bit for the scroller to settle
            setTimeout(() => {
                if (scrollId === currentScrollId) {
                    isProgrammaticScroll.value = false
                    isReady.value = true
                    emit('scroll-complete')
                    // Check active index immediately after jump
                    checkActive()
                    resolve(true)
                }
            }, 300)

            // Safety timeout
            scrollPauseTimeout = setTimeout(() => {
                if (isProgrammaticScroll.value && scrollId === currentScrollId) {
                    if(props.debugMode){
                        console.warn(`Timeline: Navigation to ${targetIndex} timed out`)
                    }
                    isProgrammaticScroll.value = false
                    isReady.value = true
                    emit('scroll-complete')
                    resolve(false)
                }
            }, 10000)
        })
    } catch (err) {
        console.error("Timeline: Navigation failed", err)
        isProgrammaticScroll.value = false
        isReady.value = true
        emit('scroll-complete')
        return Promise.resolve(false)
    }
}

// User interaction breaks the lock
let lastProgrammaticStart = 0

const unlock = (e) => {
    if (Date.now() - lastProgrammaticStart < 2000) return
    if (e && e.target) {
        const isNavUI = e.target.closest('.fixed') || e.target.closest('aside') || e.target.closest('header')
        if (isNavUI) return
    }
    
    if (isProgrammaticScroll.value || !isReady.value) {
        isProgrammaticScroll.value = false
        isReady.value = true
    }
}

onMounted(() => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
    }

    if (props.initialIndex === 0) {
        isReady.value = true
    }

    checkActive()
    window.addEventListener('wheel', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    window.addEventListener('mousedown', unlock, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto'
    }
    window.removeEventListener('wheel', unlock)
    window.removeEventListener('touchstart', unlock)
    window.removeEventListener('mousedown', unlock)
    window.removeEventListener('scroll', onScroll)
})

defineExpose({ scrollToIndex })

let scrollTimeout = null

const getActiveIndex = () => {
    const triggerY = HEADER_OFFSET
    const wrappers = document.querySelectorAll('.chunk-card-wrapper')
    
    for (const wrapper of wrappers) {
        const rect = wrapper.getBoundingClientRect()
        // Use a small buffer to avoid jitter
        if (rect.top <= triggerY + 5 && rect.bottom > triggerY + 5) {
            const index = parseInt(wrapper.getAttribute('data-index'))
            if (!isNaN(index)) return index
        }
    }
    
    // Fallback search
    let closestIndex = null
    let minDistance = Infinity
    for (const wrapper of wrappers) {
        const rect = wrapper.getBoundingClientRect()
        const distance = Math.abs(rect.top - triggerY)
        if (distance < minDistance) {
            minDistance = distance
            const index = parseInt(wrapper.getAttribute('data-index'))
            if (!isNaN(index)) closestIndex = index
        }
    }
    return closestIndex
}

const checkActive = () => {
    if (isProgrammaticScroll.value || !isReady.value) return
    const index = getActiveIndex()
    if (index !== null) {
        emit('index-change', index)
    }
}

const onScroll = () => {
    if (scrollTimeout) return
    scrollTimeout = requestAnimationFrame(() => {
        checkActive()
        scrollTimeout = null
    })
}

watch(() => props.chunks, () => {
    nextTick(checkActive)
}, { deep: false })

</script>

<template>
  <VList
    ref="scroller"
    :data="chunks"
    :style="{
      height: 'calc(100vh - 69px)',
      overflowY: 'auto'
    }"
    class="w-full scrollbar-hide"
    @scroll="onScroll"
  >
    <template #default="{ item, index }">
      <div
        class="chunk-card-wrapper"
        :data-index="index"
        :style="{ scrollMarginTop: `${HEADER_OFFSET}px` }"
      >
        <BookCard
          :item="item"
          :index="index"
          :is-bookmarked="bookmarks.includes(item.id)"
          class="chunk-card"
          @bookmark="emit('toggle-bookmark', $event)"
        />
      </div>
    </template>
  </VList>

  <!-- Debug Trigger Line -->
  <div 
    v-if="debugMode" 
    class="fixed left-0 right-0 h-[1px] bg-red-500 z-[9999] pointer-events-none flex items-center justify-end pr-2"
    :style="{ top: `${HEADER_OFFSET}px` }"
  >
    <span class="bg-red-500 text-white text-[8px] font-mono px-1">ACTIVE CHUNK TRIGGER</span>
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
/* VList with hidden scrollbar - scroll detection working */
</style>
