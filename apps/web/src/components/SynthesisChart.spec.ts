import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { Line } from "vue-chartjs";
import { withGlobalPlugins } from "../test-support/withGlobalPlugins";
import SynthesisChart from "./SynthesisChart.vue";

describe("SynthesisChart", () => {
  it("renders nothing when every series is empty", () => {
    const wrapper = mount(SynthesisChart, {
      ...withGlobalPlugins(),
      props: { series: [{ label: "Balance", color: "#000", points: [] }] },
    });
    expect(wrapper.find(".synthesis-chart").exists()).toBe(false);
  });

  it("renders the chart once at least one series has data", () => {
    const wrapper = mount(SynthesisChart, {
      ...withGlobalPlugins(),
      props: {
        series: [
          {
            label: "Balance",
            color: "#0d6efd",
            points: [
              { period: "2026-01", value: 100 },
              { period: "2026-02", value: 150 },
            ],
          },
        ],
      },
    });
    expect(wrapper.find(".synthesis-chart").exists()).toBe(true);

    const chart = wrapper.findComponent(Line);
    expect(chart.props("data")).toMatchObject({
      labels: ["2026-1", "2026-2"],
      datasets: [{ label: "Balance", data: [100, 150], borderColor: "#0d6efd" }],
    });
  });

  it("passes the optional axis bounds through to the y-scale options", () => {
    const wrapper = mount(SynthesisChart, {
      ...withGlobalPlugins(),
      props: {
        series: [{ label: "Balance", color: "#000", points: [{ period: "2026-01", value: 1 }] }],
        axisBounds: { min: 0, max: 500 },
      },
    });
    const chart = wrapper.findComponent(Line);
    expect(chart.props("options")).toMatchObject({
      scales: { y: { suggestedMin: 0, suggestedMax: 500 } },
    });
  });

  it("takes its labels from the first non-empty series", () => {
    const wrapper = mount(SynthesisChart, {
      ...withGlobalPlugins(),
      props: {
        series: [
          { label: "Empty", color: "#000", points: [] },
          { label: "Balance", color: "#000", points: [{ period: "2026-03", value: 5 }] },
        ],
      },
    });
    const chart = wrapper.findComponent(Line);
    expect(chart.props("data")).toMatchObject({ labels: ["2026-3"] });
  });
});
