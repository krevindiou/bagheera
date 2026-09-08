import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { asMockedApiClient, mockApiClient } from "../test-support/mockApiClient";
import { withGlobalPlugins } from "../test-support/withGlobalPlugins";

vi.mock("../api/client", () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from "../api/client";
import { useSessionStore } from "../stores/session.store";
import BaseLayout from "./BaseLayout.vue";

const apiClient = asMockedApiClient(realApiClient);

// A dedicated, minimal router instead of the app's real singleton: BaseLayout
// only cares that these names resolve and that push()/afterEach() work, not
// about what `<router-view>` actually renders — using the real route table
// would drag real (heavy) page components into every test here.
function createTestRouter(): Router {
  const stub = { template: "<div />" };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/sign-in", name: "sign-in", component: stub },
      { path: "/home", name: "home", component: stub },
      { path: "/accounts", name: "accounts", component: stub },
      { path: "/accounts/:accountId/operations", name: "operations", component: stub },
      { path: "/reports", name: "reports", component: stub },
      { path: "/settings/profile", name: "settings-profile", component: stub },
      { path: "/settings/password", name: "settings-password", component: stub },
      { path: "/settings/passkeys", name: "settings-passkeys", component: stub },
    ],
  });
}

const banks = [
  { id: "b1", name: "Chase", closed: false, deleted: false },
  { id: "b2", name: "Old Bank", closed: true, deleted: false },
];
const accounts = [
  { id: "a1", bankId: "b1", name: "Checking", currency: "USD", closed: false, deleted: false },
];

let wrapper: VueWrapper | undefined;
let router: Router;

describe("BaseLayout", () => {
  beforeEach(async () => {
    router = createTestRouter();
    // A freshly created memory-history router starts unresolved (no match
    // for its default "" location) until it's actually navigated once.
    await router.push({ name: "home" });
    apiClient.GET.mockReset();
    apiClient.GET.mockImplementation(async (path: string) => {
      if (path === "/banks") return { data: banks, error: undefined, response: new Response() };
      if (path === "/accounts") {
        return { data: accounts, error: undefined, response: new Response() };
      }
      return { data: undefined, error: undefined, response: new Response() };
    });
  });

  // Both a router.afterEach hook and a document click listener are
  // registered on mount and torn down on unmount — without this, they'd
  // pile up on the still-live `document`/router across every test below.
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("shows only the brand, no nav links, while signed out", () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    expect(wrapper.find(".navbar-brand").text()).toBe("Bagheera");
    expect(wrapper.find("ul.navbar-nav").exists()).toBe(false);
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  it("shows the signed-in nav once authenticated, listing only active banks/accounts", async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: "member@example.com" });

    await vi.waitFor(() => {
      if (wrapper!.findAll(".dropdown-header").length === 0) throw new Error("not loaded yet");
    });
    expect(wrapper.text()).toContain("Connected as member@example.com");
    expect(wrapper.find(".dropdown-header").text()).toBe("Chase");
    expect(wrapper.text()).not.toContain("Old Bank");
    expect(wrapper.text()).toContain("Checking");
  });

  it("toggles the accounts dropdown open and closed", async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: "member@example.com" });
    await wrapper.vm.$nextTick();

    const [accountsToggle] = wrapper.findAll("button.dropdown-toggle");
    await accountsToggle.trigger("click");
    expect(accountsToggle.classes()).toContain("show");

    await accountsToggle.trigger("click");
    expect(accountsToggle.classes()).not.toContain("show");
  });

  it("closes an open menu on an outside click", async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: "member@example.com" });
    await wrapper.vm.$nextTick();

    const [accountsToggle] = wrapper.findAll("button.dropdown-toggle");
    await accountsToggle.trigger("click");
    expect(accountsToggle.classes()).toContain("show");

    document.body.click();
    await wrapper.vm.$nextTick();
    expect(accountsToggle.classes()).not.toContain("show");
  });

  it("shows an 'Add account' link for a bank with no visible accounts", async () => {
    apiClient.GET.mockImplementation(async (path: string) => {
      if (path === "/banks") {
        return { data: banks, error: undefined, response: new Response() };
      }
      if (path === "/accounts") return { data: [], error: undefined, response: new Response() };
      return { data: undefined, error: undefined, response: new Response() };
    });
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: "member@example.com" });

    await vi.waitFor(() => {
      if (wrapper!.findAll(".dropdown-header").length === 0) throw new Error("not loaded yet");
    });
    const addAccountLink = wrapper
      .findAll(".dropdown-item")
      .find((el) => el.text() === "New account");
    expect(addAccountLink).toBeTruthy();
  });

  it("opens the settings menu, closing the accounts menu", async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: "member@example.com" });
    await wrapper.vm.$nextTick();

    const [accountsToggle, settingsToggle] = wrapper.findAll("button.dropdown-toggle");
    await accountsToggle.trigger("click");
    expect(accountsToggle.classes()).toContain("show");

    await settingsToggle.trigger("click");
    expect(settingsToggle.classes()).toContain("show");
    expect(accountsToggle.classes()).not.toContain("show");
  });

  it("refreshes the menu's bank/account data on every navigation while signed in", async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: "member@example.com" });
    await vi.waitFor(() => {
      if (wrapper!.findAll(".dropdown-header").length === 0) throw new Error("not loaded yet");
    });
    apiClient.GET.mockClear();

    await router.push({ name: "accounts" });
    await vi.waitFor(() => {
      expect(apiClient.GET).toHaveBeenCalledWith("/banks");
      expect(apiClient.GET).toHaveBeenCalledWith("/accounts");
    });
  });

  it("signs out: calls the API, clears the session, and returns to sign-in", async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: "member@example.com" });
    await wrapper.vm.$nextTick();

    await wrapper.find("button.btn-outline-light").trigger("click");
    // signOut() doesn't await its own router.push(...), so the click
    // handler's promise settles once navigation has merely started — poll
    // the route itself rather than assume it's finished by then.
    await vi.waitFor(() => {
      if (router.currentRoute.value.name !== "sign-in") throw new Error("not navigated yet");
    });

    expect(apiClient.POST).toHaveBeenCalledWith("/auth/sign-out");
    expect(useSessionStore().isAuthenticated).toBe(false);
  });
});
