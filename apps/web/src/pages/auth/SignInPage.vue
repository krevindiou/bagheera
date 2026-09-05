<script setup lang="ts">
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { apiClient } from "../../api/client";
import { useSessionStore } from "../../stores/session.store";
import { useToast } from "../../composables/useToast";
import {
  readLastAttemptedEmail,
  rememberAttemptedEmail,
} from "../../composables/useLastAttemptedEmail";
import PasswordInput from "../../components/PasswordInput.vue";
import { signInSchema, type SignInForm } from "./auth.schemas";
import ToastContainer from "../../components/ToastContainer.vue";

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

type Banner = "invalid-credentials" | "inactive" | "passkey-email-required" | null;
const banner = ref<Banner>(null);
const resendSent = ref(false);
const resending = ref(false);
const passkeySubmitting = ref(false);
const passkeysSupported = browserSupportsWebAuthn();

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

async function signInWithPasskey() {
  const attemptedEmail = (email.value ?? "").trim();
  if (!attemptedEmail) {
    banner.value = "passkey-email-required";
    return;
  }

  banner.value = null;
  passkeySubmitting.value = true;
  try {
    const { data, response } = await apiClient.POST("/webauthn/authentication/options", {
      body: { email: attemptedEmail },
    });
    if (!response.ok || !data) {
      banner.value = "invalid-credentials";
      return;
    }

    let assertion;
    try {
      assertion = await startAuthentication({
        optionsJSON: data as unknown as PublicKeyCredentialRequestOptionsJSON,
      });
    } catch {
      // The platform prompt was cancelled/dismissed — not a server error,
      // just abandon the attempt.
      return;
    }

    // See PasskeysPage.vue's comment: the generated client can't type this
    // body beyond an opaque object, since Swagger has no visibility into
    // @simplewebauthn/server's WebAuthn-spec types.
    const { response: verifyResponse } = await apiClient.POST("/webauthn/authentication/verify", {
      body: { response: assertion as unknown as Record<string, never> },
    });
    if (!verifyResponse.ok) {
      banner.value = "invalid-credentials";
      return;
    }

    rememberAttemptedEmail(attemptedEmail);
    session.setMember({ email: attemptedEmail });
    toast(t("auth.signIn.success"), "success");
    router.push({ name: "home" });
  } finally {
    passkeySubmitting.value = false;
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 480px">
    <h1>{{ $t("auth.signIn.title") }}</h1>
    <ToastContainer />

    <div v-if="banner === 'invalid-credentials'" class="alert alert-danger" role="alert">
      {{ $t("auth.signIn.invalidCredentials") }}
    </div>
    <div v-else-if="banner === 'passkey-email-required'" class="alert alert-danger" role="alert">
      {{ $t("auth.signIn.passkeyEmailRequired") }}
    </div>
    <div v-else-if="banner === 'inactive'" class="alert alert-warning" role="alert">
      <p class="mb-2">{{ $t("auth.signIn.inactiveAccount") }}</p>
      <p v-if="resendSent" class="mb-0 text-success">
        {{ $t("auth.signIn.resendSent") }}
      </p>
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
          inputmode="email"
          autocomplete="username"
          autofocus
          class="form-control"
          :class="{ 'is-invalid': errors.email }"
        />
        <div v-if="errors.email" class="invalid-feedback">
          {{ $t("auth.validation.required") }}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="sign-in-password">{{ $t("auth.signIn.password") }}</label>
        <PasswordInput
          id="sign-in-password"
          v-model="password"
          v-bind="passwordAttrs"
          :class="{ 'is-invalid': errors.password }"
        />
        <div v-if="errors.password" class="invalid-feedback">
          {{ $t("auth.validation.required") }}
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100" :disabled="isSubmitting">
        {{ $t("auth.signIn.submit") }}
      </button>
      <button
        v-if="passkeysSupported"
        type="button"
        class="btn btn-outline-secondary w-100 mt-2"
        :disabled="passkeySubmitting"
        @click="signInWithPasskey"
      >
        {{ $t("auth.signIn.passkeySubmit") }}
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
