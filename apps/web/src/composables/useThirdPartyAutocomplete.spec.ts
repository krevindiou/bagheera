import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { apiClient } from "../api/client";
import { useThirdPartyAutocomplete } from "./useThirdPartyAutocomplete";

vi.mock("../api/client", () => ({
  apiClient: { GET: vi.fn() },
}));

describe("useThirdPartyAutocomplete", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it("does not query below 2 characters", async () => {
    const thirdParty = ref("");
    const type = ref<"debit" | "credit">("debit");
    const { suggestions } = useThirdPartyAutocomplete(thirdParty, type, vi.fn());

    thirdParty.value = "a";
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(apiClient.GET).not.toHaveBeenCalled();
    expect(suggestions.value).toEqual([]);
  });

  it("queries, debounced, once the field holds at least 2 characters", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ thirdParty: "Landlord", categoryId: null }],
      response: { ok: true },
    } as never);
    const thirdParty = ref("");
    const type = ref<"debit" | "credit">("debit");
    const { suggestions } = useThirdPartyAutocomplete(thirdParty, type, vi.fn());

    thirdParty.value = "Land";
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(apiClient.GET).toHaveBeenCalledWith("/operations/autocomplete", {
      params: { query: { q: "Land", type: "debit" } },
    });
    expect(suggestions.value).toEqual([{ thirdParty: "Landlord", categoryId: null }]);
  });

  it("reports an exact match's category back via onExactMatch", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ thirdParty: "Landlord", categoryId: 7 }],
      response: { ok: true },
    } as never);
    const thirdParty = ref("");
    const type = ref<"debit" | "credit">("debit");
    const onExactMatch = vi.fn();
    useThirdPartyAutocomplete(thirdParty, type, onExactMatch);

    thirdParty.value = "Landlord";
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(onExactMatch).toHaveBeenCalledWith(7);
  });

  it("does not report a non-exact match", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ thirdParty: "Landlord", categoryId: 7 }],
      response: { ok: true },
    } as never);
    const thirdParty = ref("");
    const type = ref<"debit" | "credit">("debit");
    const onExactMatch = vi.fn();
    useThirdPartyAutocomplete(thirdParty, type, onExactMatch);

    thirdParty.value = "Land"; // partial, not exact
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(onExactMatch).not.toHaveBeenCalled();
  });
});
