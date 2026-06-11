import { z } from "zod";

export const companyTypeValues = [
  "Publisher",
  "Platform",
  "Media company",
  "Rights holder",
  "Association",
  "Other"
] as const;

const requiredString = (fieldName: string, minLength: number, maxLength: number) =>
  z
    .string({ error: `${fieldName} is required.` })
    .trim()
    .min(minLength, `${fieldName} is required.`)
    .max(maxLength, `${fieldName} must be ${maxLength} characters or fewer.`);

const optionalString = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(maxLength).nullable().optional()
  );

const optionalEmail = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z.string().email().max(254).nullable().optional()
);

export const companyProfileSchema = z
  .strictObject({
    legalName: requiredString("Legal company name", 2, 200),
    displayName: optionalString(200),
    companyType: z.enum(companyTypeValues).nullable().optional(),
    primaryContactName: requiredString("Primary contact name", 2, 200),
    primaryContactEmail: z.string().trim().email().max(254),
    billingContactEmail: optionalEmail,
    country: z
      .string({ error: "Country is required." })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Country must be an ISO 3166-1 alpha-2 code."),
    region: optionalString(100),
    city: optionalString(100),
    postalCode: optionalString(40),
    addressLine1: optionalString(200),
    addressLine2: optionalString(200),
    description: optionalString(2000)
  })
  .required({
    legalName: true,
    primaryContactName: true,
    primaryContactEmail: true,
    country: true
  });

export type CompanyProfileInput = z.input<typeof companyProfileSchema>;
export type CompanyProfile = z.output<typeof companyProfileSchema>;
