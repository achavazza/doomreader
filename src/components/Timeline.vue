<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
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
const BOTTOM_OFFSET = 300 // For detecting progress near bottom
const isProgrammaticScroll = ref(false)
const isReady = ref(false)
let scrollPauseTimeout = null
let currentScrollId = 0

    let lastY = -1
    let scrollStuckCount = 0

    const attemptRefinement = (targetIndex, attempts = 0, scrollId) => {
        return new Promise(async (resolve) => {
            if (scrollId !== currentScrollId) return resolve(false)
            
            const el = document.querySelector(`.chunk-card-wrapper[data-index="${targetIndex}"]`)
            
            if (el) {
                const rect = el.getBoundingClientRect()
                const diff = rect.top - HEADER_OFFSET
                
                if (Math.abs(diff) <= 2) {
                    console.log(`Timeline: Precisely landed on ${targetIndex}`)
                    isProgrammaticScroll.value = false
                    isReady.value = true
                    emit('scroll-complete')
                    return resolve(true)
                }

                // Smoothly refine the last few pixels
                const amount = Math.abs(diff) > 100 ? (diff > 0 ? 100 : -100) : diff
                window.scrollBy({ top: amount, behavior: 'auto' })
                
                setTimeout(() => {
                    attemptRefinement(targetIndex, attempts + 1, scrollId).then(resolve)
                }, 50)
                return
            }

            // Element NOT in DOM - Nudge Logic
            if (attempts < 60) {
                const currentY = window.scrollY
                if (currentY === lastY) {
                    scrollStuckCount++
                } else {
                    scrollStuckCount = 0
                    lastY = currentY
                }

                // If we are stuck at the bottom/top of the page for multiple attempts, stop nudging
                if (scrollStuckCount > 10) {
                    console.warn(`Timeline: Scroll stuck at ${currentY}. Target ${targetIndex} might be unreachable.`)
                    isProgrammaticScroll.value = false
                    isReady.value = true
                    emit('scroll-complete')
                    return resolve(false)
                }

                const isNudgeAttempt = attempts % 4 === 0
                const wrappers = document.querySelectorAll('.chunk-card-wrapper')
                const indices = Array.from(wrappers).map(w => parseInt(w.getAttribute('data-index'))).filter(i => !isNaN(i))
                
                if (indices.length > 0 && isNudgeAttempt) {
                    const above = indices.filter(i => i < targetIndex).sort((a,b) => b-a)[0]
                    const below = indices.filter(i => i > targetIndex).sort((a,b) => a-b)[0]
                    
                    if (above !== undefined && below !== undefined) {
                        const elAbove = document.querySelector(`.chunk-card-wrapper[data-index="${above}"]`)
                        const elBelow = document.querySelector(`.chunk-card-wrapper[data-index="${below}"]`)
                        if (elAbove && elBelow) {
                            const rectAbove = elAbove.getBoundingClientRect()
                            const rectBelow = elBelow.getBoundingClientRect()
                            const gapCenter = (rectAbove.bottom + rectBelow.top) / 2
                            window.scrollBy({ top: gapCenter - HEADER_OFFSET, behavior: 'auto' })
                        }
                    } else if (above !== undefined && above < targetIndex) {
                        // We see items above, scroll down
                        window.scrollBy({ top: 400, behavior: 'auto' })
                    } else if (below !== undefined && below > targetIndex) {
                        // We see items below, scroll up
                        window.scrollBy({ top: -400, behavior: 'auto' })
                    }
                } else if (indices.length === 0 && isNudgeAttempt) {
                    window.scrollTo({ top: targetIndex * CONFIG.CHUNK_HEIGHT_ESTIMATE, behavior: 'auto' })
                }

                // Periodically try the native scroller method
                if (attempts % 8 === 0 && scroller.value?.scrollToItem) {
                    scroller.value.scrollToItem(targetIndex)
                }
                
                setTimeout(() => attemptRefinement(targetIndex, attempts + 1, scrollId).then(resolve), 100)
            } else {
                console.error(`Timeline: Element ${targetIndex} not found in DOM after 60 attempts`)
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
        
        const scrollId = ++currentScrollId
        const targetIndex = parseInt(index)
        
        if (isNaN(targetIndex)) {
            console.error("Timeline: Invalid index for navigation", index)
            isProgrammaticScroll.value = false
            return Promise.resolve(false)
        }

        // Use estimate from config
        const estimate = targetIndex * CONFIG.CHUNK_HEIGHT_ESTIMATE
        console.log(`Timeline: Navigating to chunk ${targetIndex} (ID: ${scrollId}). Estimate: ${estimate}`)

        return new Promise(resolve => {
            // 1. Initial moderate jump to trigger virtual scroller logic
            window.scrollTo({ top: estimate, behavior: 'auto' })

            // 2. Call scroller's native scrollToItem
            setTimeout(() => {
                if (scrollId !== currentScrollId) return resolve(false)
                
                if (scroller.value && scroller.value.scrollToItem) {
                    scroller.value.scrollToItem(targetIndex)
                }
                
                // 3. Start refinement loop after a short wait for rendering
                setTimeout(() => {
                    attemptRefinement(targetIndex, 0, scrollId).then(resolve)
                }, 400) // Slightly more time for virtual scroller to render
            }, 100)

            // Safety timeout
            scrollPauseTimeout = setTimeout(() => {
                if (isProgrammaticScroll.value && scrollId === currentScrollId) {
                    console.warn(`Timeline: Navigation to ${targetIndex} timed out`)
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

const getActiveIndex = () => {
    // We use a fixed trigger point (HEADER_OFFSET) from the top
    const triggerY = HEADER_OFFSET
    
    // Get all rendered wrappers
    const wrappers = document.querySelectorAll('.chunk-card-wrapper')
    
    // 1. Primary Check: Which chunk overlaps the trigger line?
    for (const wrapper of wrappers) {
        const rect = wrapper.getBoundingClientRect()
        // A chunk is active if it spans across the trigger line
        if (rect.top <= triggerY && rect.bottom > triggerY) {
            const index = parseInt(wrapper.getAttribute('data-index'))
            if (!isNaN(index)) return index
        }
    }
    
    // 2. Secondary Check: If none strictly overlap (e.g. gaps or before first chunk), 
    // find the one whose top is closest to the trigger line
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
      :min-item-size="520"
      class="w-full"
      key-field="id"
      page-mode
      :buffer="1500"
      :prerender="20"
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
          :style="{ scrollMarginTop: `${HEADER_OFFSET}px` }"
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

    <!-- Debug Trigger Line -->
    <div 
      v-if="debugMode" 
      class="fixed left-0 right-0 h-[1px] bg-red-500 z-[9999] pointer-events-none flex items-center justify-end pr-2"
      :style="{ top: `${HEADER_OFFSET}px` }"
    >
      <span class="bg-red-500 text-white text-[8px] font-mono px-1">ACTIVE CHUNK TRIGGER</span>
    </div>
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
/* Dynamic scroll-margin-top applied via inline style to match HEADER_OFFSET */
</style>
