import { expect, it } from "vitest";
import { trafficStatus } from "./H1ConditionsCard";

it("never says Clear when there is no usual time to compare with", () => {
  expect(trafficStatus(0, undefined, true).label).toBe("Clear");
  expect(trafficStatus(0, undefined, false).label).toBe("Delay unknown");
});
