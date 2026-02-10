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

const emit = defineEmits(['index-change', 'toggle-bookmark', 'scroll-complete'])

const scroller = ref(null)
const HEADER_OFFSET = 80 // Threshold for a chunk to be considered "read" or "on top"
const BOTTOM_OFFSET = 300 // For detecting progress near bottom
const isProgrammaticScroll = ref(false)
const isReady = ref(false)
let scrollPauseTimeout = null

const attemptRefinement = (targetIndex, attempts = 0) => {
    return new Promise((resolve) => {
        const el = document.querySelector(`.chunk-card-wrapper[data-index="${targetIndex}"]`)
        
        if (el) {
            const rect = el.getBoundingClientRect()
            const viewportCenterY = window.innerHeight / 2
            
            // Calculate how far the center of the element is from the center of the viewport
            const elementCenter = rect.top + rect.height / 2
            const diff = elementCenter - viewportCenterY
            
            // If the difference is significant, scroll exactly that amount
            if (Math.abs(diff) > 2) {
                window.scrollBy({ top: diff, behavior: 'auto' })
            }
            
            // Wait for settle
            setTimeout(() => {
                const currentActive = getActiveIndexAtCenter()
                
                if (currentActive === targetIndex) {
                    console.log(`Timeline: Precisely landed on ${targetIndex}`)
                    isProgrammaticScroll.value = false 
                    isReady.value = true
                    emit('scroll-complete')
                    resolve(true)
                } 
                else if (attempts >= 15) {
                    console.warn(`Timeline: Refinement limit reached for ${targetIndex}. At ${currentActive}`)
                    isProgrammaticScroll.value = false 
                    isReady.value = true
                    emit('scroll-complete')
                    resolve(false)
                }
                else {
                    attemptRefinement(targetIndex, attempts + 1).then(resolve)
                }
            }, 100 + (attempts * 10))
        } else if (attempts < 20) {
            // Not in DOM, keep trying to force it in
            if (scroller.value && scroller.value.scrollToItem) {
                scroller.value.scrollToItem(targetIndex)
            }
            setTimeout(() => attemptRefinement(targetIndex, attempts + 1).then(resolve), 200)
        } else {
            console.error(`Timeline: Element ${targetIndex} not found in DOM after 20 attempts`)
            isProgrammaticScroll.value = false
            isReady.value = true
            emit('scroll-complete')
            resolve(false)
        }
    })
}

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
        lastProgrammaticStart = Date.now()
        
        const targetIndex = parseInt(index)

        // 1. Initial Assisted Jump (Teleport)
        // Helps the virtual scroller find the general area by moving viewport
        const estimate = targetIndex * 600 
        window.scrollTo({ top: estimate, behavior: 'auto' })

        // 2. Virtual Scroller Target
        if (scroller.value && scroller.value.scrollToItem) {
            scroller.value.scrollToItem(targetIndex)
        }
        
        // 3. Refinement Loop
        return new Promise(resolve => {
            setTimeout(() => {
                attemptRefinement(targetIndex).then(resolve)
            }, 300)

            scrollPauseTimeout = setTimeout(() => {
                if (isProgrammaticScroll.value) {
                    isProgrammaticScroll.value = false
                    isReady.value = true
                    emit('scroll-complete')
                    resolve(false)
                }
            }, 8000)
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
    // If we just started a programmatic scroll in the last 2000ms, ignore touch/mousedown
    if (Date.now() - lastProgrammaticStart < 2000) return

    // CRITICAL: Ignore if the click/touch was on a navigation button or the fixed footer/sidebar
    if (e && e.target) {
        const isNavUI = e.target.closest('.fixed') || e.target.closest('aside') || e.target.closest('header')
        if (isNavUI) {
            console.log("Timeline: Ignoring unlock trigger from Navigation UI")
            return
        }
    }
    
    if (isProgrammaticScroll.value || !isReady.value) {
        console.log("Timeline: User manually broke the lock via", e?.type, "on", e?.target?.tagName)
        isProgrammaticScroll.value = false
        isReady.value = true
    }
}

onMounted(() => {
    // Prevent browser from restoring scroll position, we handle it manually
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
    }

    if (props.initialIndex === 0) {
        isReady.value = true
    }

    checkActive() // Initial check
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

const getActiveIndexAtCenter = () => {
    // Viewport-based center detection (pure and absolute)
    const viewportCenterY = window.innerHeight / 2
    
    // Get all rendered wrappers
    const wrappers = document.querySelectorAll('.chunk-card-wrapper')
    
    // 1. Primary Check: Which chunk strictly overlaps the viewport center?
    for (const wrapper of wrappers) {
        const rect = wrapper.getBoundingClientRect()
        if (rect.top < viewportCenterY && rect.bottom > viewportCenterY) {
            const index = parseInt(wrapper.getAttribute('data-index'))
            if (!isNaN(index)) return index
        }
    }
    
    // 2. Secondary Check: If none strictly overlap (e.g. gaps), find the closest one
    let closestIndex = null
    let minDistance = Infinity
    
    for (const wrapper of wrappers) {
        const rect = wrapper.getBoundingClientRect()
        const elementCenter = rect.top + rect.height / 2
        const distance = Math.abs(elementCenter - viewportCenterY)
        
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

    const index = getActiveIndexAtCenter()
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

const onVisibleUpdate = () => {
    // DynamicScroller updated visible items
    // Good time to check active index as well
    checkActive()
}

watch(() => props.chunks, () => {
    // Chunks changed, check active
    nextTick(checkActive)
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
.chunk-card-wrapper {
    scroll-margin-top: 120px; /* Ensure scrolling to start respects header */
}
</style>
