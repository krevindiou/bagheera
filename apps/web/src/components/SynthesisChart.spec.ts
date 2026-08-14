import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SynthesisChart from "./SynthesisChart.vue";

const series = [
  {
    label: "EUR",
    color: "#0d6efd",
    points: [
      { period: "2026-01-01", value: 100 },
      { period: "2026-02-01", value: 150 },
    ],
  },
];

describe("SynthesisChart", () => {
  it("renders a canvas when given series data", () => {
    const wrapper = mount(SynthesisChart, {
      props: { series, axisBounds: { min: -1, max: 1 } },
    });

    expect(wrapper.find("canvas").exists()).toBe(true);
  });

  it("renders nothing when every series is empty", () => {
    const wrapper = mount(SynthesisChart, {
      props: { series: [{ label: "EUR", color: "#0d6efd", points: [] }] },
    });

    expect(wrapper.find("canvas").exists()).toBe(false);
    expect(wrapper.html()).toBe("<!--v-if-->");
  });

  it("renders nothing when no series are given at all", () => {
    const wrapper = mount(SynthesisChart, { props: { series: [] } });

    expect(wrapper.find("canvas").exists()).toBe(false);
  });
});
