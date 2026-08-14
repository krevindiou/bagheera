<script setup lang="ts">
import { useConfirm } from "../composables/useConfirm";

const { state, settle } = useConfirm();
</script>

<template>
  <div v-if="state.visible" class="modal d-block" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-body">{{ state.message }}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="settle(false)">
            {{ $t("common.cancel") }}
          </button>
          <button type="button" class="btn btn-primary" @click="settle(true)">
            {{ $t("common.confirm") }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="state.visible" class="modal-backdrop show"></div>
</template>
