import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import ReportForm from "./ReportForm.vue";
import type { Account } from "../accounts/accounts.types";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn(), PATCH: vi.fn() },
}));

const accounts: Account[] = [
  { id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false },
  { id: 2, bankId: 1, name: "Savings", currency: "USD", closed: false, deleted: false },
];

function mountForm() {
  return mount(ReportForm, { props: { accounts }, global: { plugins: [i18n] } });
}

describe("ReportForm", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(apiClient.PATCH).mockReset();
  });

  it("submits the selected account ids and period grouping", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      data: { message: "Report saved", report: { id: 1 } },
      response: { ok: true },
    } as never);

    const wrapper = mountForm();
    await wrapper.find("#report-title").setValue("Monthly spend");
    await wrapper.find("#report-accounts").setValue(["1"]);
    await wrapper.find("#report-period-grouping").setValue("quarter");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      "/reports",
      expect.objectContaining({
        body: expect.objectContaining({
          title: "Monthly spend",
          accountIds: [1],
          periodGrouping: "quarter",
        }),
      }),
    );
  });

  it("prefills from an existing report when editing", () => {
    const wrapper = mount(ReportForm, {
      props: {
        accounts,
        report: {
          id: 5,
          memberId: 1,
          type: "average",
          title: "Existing",
          homepage: true,
          valueDateStart: null,
          valueDateEnd: null,
          thirdParties: null,
          accountIds: [2],
          reconciledOnly: true,
          periodGrouping: "year",
        },
      },
      global: { plugins: [i18n] },
    });

    expect(wrapper.get<HTMLInputElement>("#report-title").element.value).toBe("Existing");
    expect(wrapper.get<HTMLInputElement>("#report-type-average").element.checked).toBe(true);
    expect(wrapper.get<HTMLSelectElement>("#report-reconciled").element.value).toBe("true");
  });
});
