import { describe, expect, it } from "vitest";
import { describeRpeChips, RPE_CHOICES, toggleRpe } from "./rpe";

describe("RPE_CHOICES", () => {
	it("offers the whole numbers 6 to 10", () => {
		expect(RPE_CHOICES).toEqual([6, 7, 8, 9, 10]);
	});
});

describe("toggleRpe", () => {
	it("sets the tapped RPE when none is stored", () => {
		expect(toggleRpe(undefined, 8)).toBe(8);
	});

	it("replaces another stored RPE", () => {
		expect(toggleRpe(7, 9)).toBe(9);
	});

	it("clears the RPE when the selected chip is tapped again", () => {
		expect(toggleRpe(8, 8)).toBeUndefined();
	});

	it("replaces an imported decimal RPE with the tapped whole number", () => {
		expect(toggleRpe(8.5, 8)).toBe(8);
		expect(toggleRpe(8.5, 9)).toBe(9);
	});
});

describe("describeRpeChips", () => {
	it("selects no chip and shows nothing else when no RPE is stored", () => {
		const view = describeRpeChips(undefined);
		expect(view.chips.map((chip) => chip.value)).toEqual([6, 7, 8, 9, 10]);
		expect(view.chips.every((chip) => !chip.selected)).toBe(true);
		expect(view.other).toBeUndefined();
	});

	it("selects the chip of a whole-number RPE on the row", () => {
		const view = describeRpeChips(9);
		expect(
			view.chips.filter((chip) => chip.selected).map((chip) => chip.value),
		).toEqual([9]);
		expect(view.other).toBeUndefined();
	});

	it("shows a decimal RPE beside the row, selecting no chip", () => {
		const view = describeRpeChips(8.5);
		expect(view.chips.every((chip) => !chip.selected)).toBe(true);
		expect(view.other).toBe("8.5");
	});

	it("shows an RPE outside 6 to 10 beside the row", () => {
		const view = describeRpeChips(5);
		expect(view.chips.every((chip) => !chip.selected)).toBe(true);
		expect(view.other).toBe("5");
	});
});
