<script setup>
import { Book as BookIcon, Plus, Library } from 'lucide-vue-next'
import { computed } from 'vue'
import { useBookStore } from '../stores/bookStore'

const store = useBookStore()

const emit = defineEmits(['add-book'])

const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
        emit('add-book', file)
    }
}
</script>

<template>
  <aside class="w-[300px] h-screen sticky top-0 hidden lg:flex flex-col p-8 border-r border-gray-800 bg-black text-white">
      <!-- Logo / Brand -->
      <div class="mb-12">
          <h1 class="text-2xl font-bold tracking-tighter flex items-center gap-2">
                <img src="/favicon.png" alt="Logo" class="w-8 h-8" style="vertical-align: middle;"/>
                doomreader
          </h1>
      </div>

      <!-- Library Stats -->
      <div class="w-full aspect-[2/3] bg-gray-900 rounded-lg shadow-2xl overflow-hidden mb-6 border border-gray-800 flex flex-col items-center justify-center text-gray-500 gap-4 p-6 text-center">
          <Library class="w-16 h-16 opacity-50 text-blue-500" />
          <div>
              <span class="text-3xl font-bold text-white block">{{ store.shelf.length }}</span>
              <span class="text-sm uppercase tracking-widest">Books in Shelf</span>
          </div>
      </div>

      <!-- Main Actions -->
      <div class="space-y-4 mb-auto">
          <label class="flex items-center justify-center gap-3 bg-white text-black hover:bg-gray-200 font-bold py-4 px-6 rounded-xl cursor-pointer transition transform hover:scale-[1.02] active:scale-95 shadow-lg w-full">
                <Plus class="w-5 h-5" />
                <span>Add New Book</span>
                <input type="file" accept=".epub,.docx,.doc" class="hidden" @change="handleFileUpload" :disabled="store.loading">
          </label>
          
          <p class="text-xs text-gray-600 text-center leading-relaxed px-4">
              Supported formats: EPUB, DOCX, DOC. <br>
              Files are processed locally in your browser.
          </p>
      </div>

      <!-- Footer / Info -->
      <div class="mt-auto pt-6 border-t border-gray-900 text-xs text-gray-600">
          <p>&copy; 2026 DoomReader</p>
          <p class="mt-1">Local-first reader.</p>
      </div>
  </aside>
</template>
