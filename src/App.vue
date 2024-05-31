<script setup lang="ts">
const arr = ref([])

const marginLeft = ref('0')
window.ipcRenderer.on('resized', (_event, data) => {
  marginLeft.value = data.width
})

window.ipcRenderer.on('resp', (_event, data) => {
  // arr.value.unshift(data)
})
</script>

<template>
  <div :style="{ 'margin-left': `${marginLeft}px` }">
    {{ arr }}
  </div>
</template>
