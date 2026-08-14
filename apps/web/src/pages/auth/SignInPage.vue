<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { apiClient } from "../../api/client";
import { useSessionStore } from "../../stores/session.store";
import { useToast } from "../../composables/useToast";
import {
  readLastAttemptedEmail,
  rememberAttemptedEmail,
} from "../../composables/useLastAttemptedEmail";
import { signInSchema, type SignInForm } from "./auth.schemas";

const router = useRouter();
const session = useSessionStore();
const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<SignInForm>({
  validationSchema: toTypedSchema(signInSchema),
  initialValues: { email: readLastAttemptedEmail(), password: "" },
});
const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");

type Banner = "invalid-credentials" | "inactive" | null;
const banner = ref<Banner>(null);
const resendSent = ref(false);
const resending = ref(false);

async function resendActivation() {
  resending.value = true;
  try {
    const { response } = await apiClient.POST("/members/resend-activation", {
      body: { email: email.value ?? "", password: password.value ?? "" },
    });
    if (response.ok) {
      resendSent.value = true;
    }
  } finally {
    resending.value = false;
  }
}

const onSubmit = handleSubmit(async (values) => {
  banner.value = null;
  resendSent.value = false;
  rememberAttemptedEmail(values.email);

  const { response } = await apiClient.POST("/auth/sign-in", { body: values });

  if (response.status === 403) {
    banner.value = "inactive";
    return;
  }
  if (!response.ok) {
    banner.value = "invalid-credentials";
    return;
  }

  session.setMember({ email: values.email });
  toast(t("auth.signIn.success"), "success");
  router.push({ name: "home" });
});
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("auth.signIn.title") }}</h1>

    <div v-if="banner === 'invalid-credentials'" class="alert alert-danger" role="alert">
      {{ $t("auth.signIn.invalidCredentials") }}
    </div>
    <div v-else-if="banner === 'inactive'" class="alert alert-warning" role="alert">
      <p class="mb-2">{{ $t("auth.signIn.inactiveAccount") }}</p>
      <p v-if="resendSent" class="mb-0 text-success">{{ $t("auth.signIn.resendSent") }}</p>
      <button
        v-else
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="resending"
        @click="resendActivation"
      >
        {{ $t("auth.signIn.resendActivation") }}
      </button>
    </div>

    <form novalidate @submit="onSubmit">
      <div class="mb-3">
        <label class="form-label" for="sign-in-email">{{ $t("auth.signIn.email") }}</label>
        <input
          id="sign-in-email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          class="form-control"
          :class="{ 'is-invalid': errors.email }"
        />
        <div v-if="errors.email" class="invalid-feedback">{{ $t("auth.validation.required") }}</div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="sign-in-password">{{ $t("auth.signIn.password") }}</label>
        <input
          id="sign-in-password"
          v-model="password"
          v-bind="passwordAttrs"
          type="password"
          class="form-control"
          :class="{ 'is-invalid': errors.password }"
        />
        <div v-if="errors.password" class="invalid-feedback">
          {{ $t("auth.validation.required") }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t("auth.signIn.submit") }}
      </button>
    </form>

    <div class="d-flex justify-content-between mt-3">
      <router-link :to="{ name: 'forgot-password' }">{{
        $t("auth.signIn.forgotPasswordLink")
      }}</router-link>
      <router-link :to="{ name: 'register' }">{{ $t("auth.signIn.registerLink") }}</router-link>
    </div>
  </div>
</template>
