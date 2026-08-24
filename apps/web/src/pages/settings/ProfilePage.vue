<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useSessionStore } from "../../stores/session.store";
import { useToast } from "../../composables/useToast";
import PasswordInput from "../../components/PasswordInput.vue";
import { profileSchema, type ProfileForm } from "./settings.schemas";

const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting, resetField } = useForm<ProfileForm>({
  validationSchema: toTypedSchema(profileSchema),
  initialValues: { email: session.member?.email ?? "", currentPassword: "" },
});
const [email, emailAttrs] = defineField("email");
const [currentPassword, currentPasswordAttrs] = defineField("currentPassword");

const onSubmit = handleSubmit(async (values) => {
  const { data, error, response } = await apiClient.POST("/members/profile", {
    body: values,
  });

  if (!response.ok) {
    const message = errorMessage(error) ?? t("settings.profile.genericError");
    toast(message, "error");
    return;
  }

  session.setMember({ email: values.email });
  resetField("currentPassword");
  toast(data?.message ?? t("settings.profile.success"), "success");
});

function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("settings.profile.title") }}</h1>

    <form novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="profile-email">{{ $t("settings.profile.email") }}</label>
        <input
          id="profile-email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          inputmode="email"
          autocomplete="email"
          class="form-control"
          :class="{ 'is-invalid': errors.email }"
        />
        <div v-if="errors.email" class="invalid-feedback">
          {{ $t("auth.validation.email") }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="profile-current-password">
          {{ $t("settings.profile.currentPassword") }}
        </label>
        <PasswordInput
          id="profile-current-password"
          v-model="currentPassword"
          v-bind="currentPasswordAttrs"
          :class="{ 'is-invalid': errors.currentPassword }"
        />
        <div v-if="errors.currentPassword" class="invalid-feedback">
          {{ $t("auth.validation.required") }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t("settings.profile.submit") }}
      </button>
    </form>
  </div>
</template>
