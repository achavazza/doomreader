<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
    <RouterView />
  </div>
</template>

<style>
/* Global styles if needed */
body {
  margin: 0;
  overflow-x: hidden;
}
</style>
