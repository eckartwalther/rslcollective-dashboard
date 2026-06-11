import { companyProfileSchema } from "../src/schemas/company";

const validPayload = {
  legalName: "Example Media Inc.",
  displayName: "Example Media",
  companyType: "Publisher",
  primaryContactName: "Jane Publisher",
  primaryContactEmail: "jane@example.com",
  billingContactEmail: "billing@example.com",
  country: "US",
  region: "CA",
  city: "Los Angeles",
  postalCode: "90001",
  addressLine1: "123 Main Street",
  addressLine2: "Suite 4",
  description: "Example publisher profile."
};

describe("companyProfileSchema", () => {
  it("accepts a valid payload", () => {
    expect(companyProfileSchema.parse(validPayload)).toEqual(validPayload);
  });

  it("normalizes empty optional strings to null", () => {
    const parsed = companyProfileSchema.parse({
      ...validPayload,
      displayName: " ",
      billingContactEmail: "",
      region: "",
      city: " ",
      postalCode: "",
      addressLine1: "",
      addressLine2: " ",
      description: ""
    });

    expect(parsed.displayName).toBeNull();
    expect(parsed.billingContactEmail).toBeNull();
    expect(parsed.region).toBeNull();
    expect(parsed.city).toBeNull();
    expect(parsed.postalCode).toBeNull();
    expect(parsed.addressLine1).toBeNull();
    expect(parsed.addressLine2).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("rejects invalid email fields", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        primaryContactEmail: "not-an-email"
      })
    ).toThrow();

    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        billingContactEmail: "not-an-email"
      })
    ).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        website: "https://example.com"
      })
    ).toThrow();
  });

  it("rejects company_id", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        company_id: "cmp_test"
      })
    ).toThrow();
  });

  it("rejects companyId", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        companyId: "cmp_test"
      })
    ).toThrow();
  });

  it("rejects role", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        role: "owner"
      })
    ).toThrow();
  });

  it("rejects status", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        status: "approved"
      })
    ).toThrow();
  });

  it("rejects unsupported company_type values", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        companyType: "Agency"
      })
    ).toThrow();
  });

  it("rejects unsupported company_type request fields", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        company_type: "Agency"
      })
    ).toThrow();
  });

  it("normalizes country to uppercase", () => {
    expect(
      companyProfileSchema.parse({
        ...validPayload,
        country: "gb"
      }).country
    ).toBe("GB");
  });

  it("rejects invalid country values", () => {
    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        country: "USA"
      })
    ).toThrow();

    expect(() =>
      companyProfileSchema.parse({
        ...validPayload,
        country: "1A"
      })
    ).toThrow();
  });
});
