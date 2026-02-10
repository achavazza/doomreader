<script setup>
defineProps({
    message: {
        type: String,
        default: 'Loading...'
    },
    subMessage: {
        type: String,
        default: ''
    },
    fullscreen: {
        type: Boolean,
        default: false
    }
})
</script>

<template>
    <div 
        :class="[
            'flex items-center justify-center', 
            fullscreen ? 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm' : 'flex-col p-20'
        ]"
    >
        <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <p class="text-blue-500 font-mono text-sm uppercase tracking-widest animate-pulse">{{ message }}</p>
            <p v-if="subMessage" class="text-[10px] text-gray-600 mt-2 max-w-[200px] text-center">{{ subMessage }}</p>
        </div>
    </div>
</template>
