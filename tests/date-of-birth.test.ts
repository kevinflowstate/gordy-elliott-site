import assert from "node:assert/strict";
import test from "node:test";
import { dateOfBirthFromIso, dateOfBirthToIso, formatDateOfBirthInput, isValidIsoDateOfBirth } from "../lib/date-of-birth";

test("date of birth converts between UK display and ISO storage", () => {
  assert.equal(dateOfBirthToIso("09/04/1987"), "1987-04-09");
  assert.equal(dateOfBirthFromIso("1987-04-09"), "09/04/1987");
});

test("date of birth rejects impossible and future dates", () => {
  assert.equal(dateOfBirthToIso("31/02/1990"), null);
  assert.equal(isValidIsoDateOfBirth("2999-01-01"), false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(isValidIsoDateOfBirth([
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0"),
  ].join("-")), false);
});

test("date of birth input formats digits as DD/MM/YYYY", () => {
  assert.equal(formatDateOfBirthInput("09041987"), "09/04/1987");
});
