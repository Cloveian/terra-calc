import { test } from "node:test";
import assert from "node:assert/strict";
import { stepped } from "../src/stepper.js";

test("stepped: one arrow click, kept in min/max, step any = 1", () => {
    const hours = { step: "0.1", min: "0", max: "24" };
    assert.equal(stepped("6.4", hours, 1), "6.5");
    assert.equal(stepped("", hours, -1), "0.0"); // empty box from 0, can't go under min
    assert.equal(stepped("24", hours, 1), "24.0");
    assert.equal(stepped("#", { step: "any", min: "1", max: "" }, 1), "1"); // the priority box's placeholder
    assert.equal(stepped("3", { step: "any", min: "1", max: "" }, 1), "4");
});
