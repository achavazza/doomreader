<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  currentIndex: {
    type: Number,
    required: true
  },
  totalChunks: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['scroll-to-index'])

// Track dimensions
const scrollbarRef = ref(null)
const trackHeight = ref(0)
const isDragging = ref(false)
const dragStartY = ref(0)
const dragStartIndex = ref(0)

// Calculate thumb position and size
const thumbHeight = computed(() => {
  if (props.totalChunks <= 1) return trackHeight.value
  // Minimum thumb height of 40px, maximum 30% of track
  const minHeight = 40
  const maxHeight = trackHeight.value * 0.3
  const calculated = trackHeight.value / Math.sqrt(props.totalChunks / 10)
  return Math.max(minHeight, Math.min(maxHeight, calculated))
})

const thumbPosition = computed(() => {
  if (props.totalChunks <= 1) return 0
  const availableSpace = trackHeight.value - thumbHeight.value
  const progress = props.currentIndex / (props.totalChunks - 1)
  return progress * availableSpace
})

// Update track height on resize
const updateTrackHeight = () => {
  if (scrollbarRef.value) {
    trackHeight.value = scrollbarRef.value.clientHeight
  }
}

// Handle mouse events for dragging
const handleMouseDown = (e) => {
  isDragging.value = true
  dragStartY.value = e.clientY
  dragStartIndex.value = props.currentIndex
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  e.preventDefault()
}

const handleMouseMove = (e) => {
  if (!isDragging.value) return
  
  const deltaY = e.clientY - dragStartY.value
  const availableSpace = trackHeight.value - thumbHeight.value
  const indexDelta = (deltaY / availableSpace) * (props.totalChunks - 1)
  
  let newIndex = Math.round(dragStartIndex.value + indexDelta)
  newIndex = Math.max(0, Math.min(props.totalChunks - 1, newIndex))
  
  if (newIndex !== props.currentIndex) {
    emit('scroll-to-index', newIndex)
  }
}

const handleMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// Handle click on track to jump
const handleTrackClick = (e) => {
  if (e.target === e.currentTarget) {
    const rect = scrollbarRef.value.getBoundingClientRect()
    const clickY = e.clientY - rect.top - (thumbHeight.value / 2)
    const availableSpace = trackHeight.value - thumbHeight.value
    const progress = Math.max(0, Math.min(1, clickY / availableSpace))
    const newIndex = Math.round(progress * (props.totalChunks - 1))
    emit('scroll-to-index', newIndex)
  }
}

// Handle wheel events on scrollbar
const handleWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 1 : -1
  const newIndex = Math.max(0, Math.min(props.totalChunks - 1, props.currentIndex + delta))
  if (newIndex !== props.currentIndex) {
    emit('scroll-to-index', newIndex)
  }
}

onMounted(() => {
  updateTrackHeight()
  window.addEventListener('resize', updateTrackHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTrackHeight)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div
    ref="scrollbarRef"
    class="fixed right-0 top-[69px] bottom-0 w-3 bg-gray-900/50 hidden lg:block z-40 hover:bg-gray-800/50 transition-colors cursor-pointer"
    @click="handleTrackClick"
    @wheel="handleWheel"
  >
    <!-- Track line -->
    <div class="absolute left-1/2 top-0 bottom-0 w-px bg-gray-700/50 -translate-x-1/2"></div>
    
    <!-- Thumb -->
    <div
      class="absolute left-0 right-0 bg-gray-500 hover:bg-gray-400 rounded-full transition-colors cursor-grab active:cursor-grabbing"
      :style="{
        height: `${thumbHeight}px`,
        top: `${thumbPosition}px`,
        margin: '0 2px'
      }"
      @mousedown="handleMouseDown"
      @click.stop
    ></div>
    
    <!-- Progress indicator -->
    <div
      class="absolute left-1/2 top-0 w-px bg-blue-500/50 -translate-x-1/2 pointer-events-none"
      :style="{ height: `${thumbPosition + thumbHeight / 2}px` }"
    ></div>
  </div>
</template>

<style scoped>
/* Smooth transitions for thumb */
div {
  will-change: transform;
}
</style>
