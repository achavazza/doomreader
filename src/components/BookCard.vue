<script setup>
import { Bookmark, Image as ImageIcon, Loader } from 'lucide-vue-next'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storageService } from '../services/storageService'
import { CONFIG } from '../config'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  isBookmarked: {
      type: Boolean,
      default: false
  }
})

const emit = defineEmits(['bookmark'])
const route = useRoute()
const bookId = route.params.id

const blobUrl = ref(null)
const imageLoading = ref(false)

const loadImage = async () => {
    if (props.item.type !== 'image') return
    
    // If it's already a base64 or external URL
    if (props.item.src && (props.item.src.startsWith('data:') || props.item.src.startsWith('http'))) {
        blobUrl.value = props.item.src
        return
    }

    imageLoading.value = true
    try {
        const path = props.item.resolvedPath || props.item.src
        const blob = await storageService.getImage(bookId, path)
        if (blob) {
            if (blobUrl.value && blobUrl.value.startsWith('blob:')) {
                URL.revokeObjectURL(blobUrl.value)
            }
            blobUrl.value = URL.createObjectURL(blob)
        }
    } catch (e) {
        console.warn("Failed to lazy load image", e)
    } finally {
        imageLoading.value = false
    }
}

onMounted(loadImage)

// Watch for reuse in virtual scroller
watch(() => props.item.id, () => {
    if (blobUrl.value && blobUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl.value)
    }
    blobUrl.value = null
    loadImage()
})

onUnmounted(() => {
    if (blobUrl.value && blobUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl.value)
    }
})
</script>

<template>
  <div class="border-y border-gray-800/10 hover:border-gray-800 px-8 py-10 hover:bg-gray-900/50 transition-colors relative group min-h-[50px]">
    <!-- Debug Chunk Number -->
    <div class="absolute left-2 top-2 text-[10px] font-mono text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
        #{{ index }}
    </div>

    <!-- Optional Chapter -->
    <div v-if="item.chapter" class="hidden text-xs text-gray-500 mb-2 uppercase tracking-wider">
        {{ item.chapter }}
    </div>

    <!-- Body Content -->
    <div class="text-[18px] leading-relaxed text-gray-200 whitespace-pre-wrap font-serif">
        <template v-if="item.type === 'text'">
            {{ item.content }}
        </template>
        
        <template v-else-if="item.type === 'image'">
            <!-- Note: User requested not to load internal images, but handling placeholder just in case -->
            <div class="my-6 rounded-xl overflow-hidden border border-gray-800 bg-gray-900/50 group/img relative min-h-[100px] flex items-center justify-center">
                <div v-if="imageLoading" class="p-8">
                    <Loader class="w-6 h-6 animate-spin text-gray-600" />
                </div>
                <img v-else-if="blobUrl" :src="blobUrl" class="w-full h-auto max-h-[800px] object-contain block" loading="lazy" />
                <div v-else class="p-12 flex flex-col items-center gap-2 text-gray-700">
                    <ImageIcon class="w-8 h-8 opacity-20" />
                    <span class="text-[10px] font-mono opacity-20 uppercase tracking-widest">Image Content Skipped</span>
                </div>
            </div>
        </template>
        
        <template v-else-if="item.type === 'header'">
            <h2 class="text-3xl font-bold text-white my-8 leading-tight">{{ item.content }}</h2>
        </template>
    </div>

    <!-- Bookmark Button -->
    <button 
        @click="$emit('bookmark', item)"
        class="absolute top-2 right-2 transition-all duration-300 p-2 rounded-full"
        :class="isBookmarked ? 'text-blue-500 scale-110 opacity-100' : 'text-gray-700 hover:text-blue-500 opacity-0 group-hover:opacity-100'"
        title="Bookmark this position"
    >
        <Bookmark class="w-4 h-4" :class="{ 'fill-current': isBookmarked }" />
    </button>
  </div>
</template>
