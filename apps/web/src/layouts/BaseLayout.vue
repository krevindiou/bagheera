<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { apiClient } from "../api/client";
import type { Account, Bank } from "../pages/accounts/accounts.types";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useSessionStore } from "../stores/session.store";

const session = useSessionStore();
const router = useRouter();
const queryClient = useQueryClient();

const isAuthenticated = computed(() => session.isAuthenticated);

const banksQuery = useQuery({
  queryKey: ["banks"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/banks");
    return (data as Bank[] | undefined) ?? [];
  },
  enabled: isAuthenticated,
});
const banks = computed(() => banksQuery.data.value ?? []);

const accountsQuery = useQuery({
  queryKey: ["accounts"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/accounts");
    return (data as Account[] | undefined) ?? [];
  },
  enabled: isAuthenticated,
});
const accounts = computed(() => accountsQuery.data.value ?? []);

const accountsMenuOpen = ref(false);
const settingsMenuOpen = ref(false);

// Bank/account rows can be created, renamed, closed or deleted from other
// pages — refresh the menu on every navigation so it never goes stale.
// This also keeps any other page's ["banks"]/["accounts"] queries in sync.
const stopAfterEach = router.afterEach(() => {
  if (!session.isAuthenticated) return;
  void queryClient.invalidateQueries({ queryKey: ["banks"] });
  void queryClient.invalidateQueries({ queryKey: ["accounts"] });
});
onBeforeUnmount(stopAfterEach);

// Menus are day-to-day navigation, so closed/deleted banks and accounts are
// hidden here even though the accounts management screen still lists them.
function accountsForBank(bankId: number) {
  return accounts.value.filter(
    (account) => account.bankId === bankId && !account.closed && !account.deleted,
  );
}

function closeMenus() {
  accountsMenuOpen.value = false;
  settingsMenuOpen.value = false;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest("[data-nav-dropdown]")) {
    closeMenus();
  }
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick));

async function signOut() {
  await apiClient.POST("/auth/sign-out");
  session.clear();
  router.push({ name: "sign-in" });
}
</script>

<template>
  <div id="app-root">
    <nav class="navbar navbar-expand navbar-dark bg-dark">
      <div class="container-fluid">
        <router-link v-if="session.isAuthenticated" :to="{ name: 'home' }" class="navbar-brand">
          {{ $t("app.brand") }}
        </router-link>
        <span v-else class="navbar-brand">{{ $t("app.brand") }}</span>

        <template v-if="session.isAuthenticated">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <router-link :to="{ name: 'home' }" class="nav-link">
                {{ $t("nav.home") }}
              </router-link>
            </li>
            <li class="nav-item dropdown" data-nav-dropdown>
              <button
                type="button"
                class="nav-link dropdown-toggle btn btn-link"
                :class="{ show: accountsMenuOpen }"
                @click="
                  accountsMenuOpen = !accountsMenuOpen;
                  settingsMenuOpen = false;
                "
              >
                {{ $t("nav.accounts") }}
              </button>
              <ul class="dropdown-menu" :class="{ show: accountsMenuOpen }" @click="closeMenus">
                <template v-for="bank in banks" :key="bank.id">
                  <li v-if="!bank.closed && !bank.deleted">
                    <h6 class="dropdown-header">{{ bank.name }}</h6>
                    <router-link
                      v-for="account in accountsForBank(bank.id)"
                      :key="account.id"
                      :to="{ name: 'operations', params: { accountId: account.id } }"
                      class="dropdown-item"
                    >
                      {{ account.name }}
                    </router-link>
                    <router-link
                      v-if="accountsForBank(bank.id).length === 0"
                      :to="{ name: 'accounts' }"
                      class="dropdown-item"
                    >
                      {{ $t("accounts.addAccount") }}
                    </router-link>
                  </li>
                </template>
              </ul>
            </li>
            <li class="nav-item dropdown" data-nav-dropdown>
              <button
                type="button"
                class="nav-link dropdown-toggle btn btn-link"
                :class="{ show: settingsMenuOpen }"
                @click="
                  settingsMenuOpen = !settingsMenuOpen;
                  accountsMenuOpen = false;
                "
              >
                {{ $t("nav.settings") }}
              </button>
              <ul class="dropdown-menu" :class="{ show: settingsMenuOpen }" @click="closeMenus">
                <li>
                  <router-link :to="{ name: 'accounts' }" class="dropdown-item">
                    {{ $t("home.accountsLink") }}
                  </router-link>
                </li>
                <li>
                  <router-link :to="{ name: 'reports' }" class="dropdown-item">
                    {{ $t("dashboard.reportsLink") }}
                  </router-link>
                </li>
                <li>
                  <router-link :to="{ name: 'settings-profile' }" class="dropdown-item">
                    {{ $t("home.profileLink") }}
                  </router-link>
                </li>
                <li>
                  <router-link :to="{ name: 'settings-password' }" class="dropdown-item">
                    {{ $t("home.passwordLink") }}
                  </router-link>
                </li>
              </ul>
            </li>
          </ul>
          <span class="navbar-text text-light me-3">
            {{ $t("home.signedInAs", { email: session.member?.email }) }}
          </span>
          <button type="button" class="btn btn-outline-light btn-sm" @click="signOut">
            {{ $t("home.signOut") }}
          </button>
        </template>
      </div>
    </nav>
    <main>
      <router-view />
    </main>
    <ConfirmModal />
  </div>
</template>
