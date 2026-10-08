<script setup lang="ts">
import { computed } from 'vue';
import { paymentMethodIcon, paymentMethodName, type PaymentMethod } from '../domain/referenceData';
import AppIcon from './AppIcon.vue';

// A payment method's glyph, labeled with its localized name. Nothing for an
// id without an icon.
const props = defineProps<{ id: string; paymentMethods: PaymentMethod[] }>();

const icon = computed(() => paymentMethodIcon(props.id));
const name = computed(() => paymentMethodName(props.id, props.paymentMethods));
</script>

<template>
  <span v-if="icon" role="img" :title="name" :aria-label="name">
    <AppIcon :name="icon" :size="16" />
  </span>
</template>
