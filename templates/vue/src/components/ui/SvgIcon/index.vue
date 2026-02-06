<script setup lang="ts">
const props = defineProps<{
  name: string;
  rotate?: boolean;
}>();
const { name, rotate } = props;
</script>

<template>
  <svg
    v-bind="props"
    class="inline-block w-[1.5rem] h-[1.5rem] align-middle transition-transform duration-500 ease-in-out"
    :class="{ 'animate-spin': rotate }"
    aria-hidden="true"
  >
    <use :xlink:href="`#icon-${name}`" fill="currentColor" />
  </svg>
</template>
