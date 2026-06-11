import { Alert, Button, Group, Paper, Select, Stack, TextInput, Textarea } from "@mantine/core";
import { FormEvent, useEffect, useState } from "react";
import { ZodError } from "zod";
import { ApiError } from "../../api/client";
import { type Company, useSaveCompanyMutation } from "../../api/company";
import {
  companyProfileSchema,
  companyTypeValues
} from "../../schemas/company";

type CompanyProfileFormProps = {
  company: Company | null;
};

type CompanyTypeValue = (typeof companyTypeValues)[number];

type CompanyProfileFormValues = {
  legalName: string;
  displayName: string;
  companyType: CompanyTypeValue | null;
  primaryContactName: string;
  primaryContactEmail: string;
  billingContactEmail: string;
  country: string;
  region: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  description: string;
};

type FieldErrors = Partial<Record<keyof CompanyProfileFormValues, string>>;

const emptyValues = {
  legalName: "",
  displayName: "",
  companyType: null,
  primaryContactName: "",
  primaryContactEmail: "",
  billingContactEmail: "",
  country: "",
  region: "",
  city: "",
  postalCode: "",
  addressLine1: "",
  addressLine2: "",
  description: ""
} satisfies CompanyProfileFormValues;

export function CompanyProfileForm({ company }: CompanyProfileFormProps) {
  const saveCompanyMutation = useSaveCompanyMutation();
  const [values, setValues] = useState<CompanyProfileFormValues>(() => companyToFormValues(company));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(companyToFormValues(company));
    setFieldErrors({});
    setFormMessage(null);
    setSaved(false);
  }, [company]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormMessage(null);
    setSaved(false);

    const parsed = companyProfileSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    try {
      await saveCompanyMutation.mutateAsync(parsed.data);
      setSaved(true);
    } catch (error) {
      const apiError = getApiValidationError(error);

      if (apiError.fields) {
        setFieldErrors(apiError.fields);
      }

      setFormMessage(apiError.message);
    }
  }

  return (
    <Paper component="form" withBorder radius="md" p="lg" noValidate onSubmit={handleSubmit}>
      <Stack gap="md">
        {saved ? (
          <Alert color="green" title="Company profile saved">
            Your company profile has been saved.
          </Alert>
        ) : null}
        {formMessage ? (
          <Alert color="red" title="Company profile could not be saved">
            {formMessage}
          </Alert>
        ) : null}

        <TextInput
          label="Legal company name"
          value={values.legalName}
          error={fieldErrors.legalName}
          required
          onChange={(event) => updateValue("legalName", event.currentTarget.value)}
        />
        <TextInput
          label="Display name"
          value={values.displayName ?? ""}
          error={fieldErrors.displayName}
          onChange={(event) => updateValue("displayName", event.currentTarget.value)}
        />
        <Select
          label="Company type"
          data={[...companyTypeValues]}
          value={values.companyType ?? null}
          error={fieldErrors.companyType}
          clearable
          onChange={(value) => updateValue("companyType", toCompanyTypeValue(value))}
        />
        <TextInput
          label="Primary contact name"
          value={values.primaryContactName}
          error={fieldErrors.primaryContactName}
          required
          onChange={(event) => updateValue("primaryContactName", event.currentTarget.value)}
        />
        <TextInput
          label="Primary contact email"
          type="email"
          value={values.primaryContactEmail}
          error={fieldErrors.primaryContactEmail}
          required
          onChange={(event) => updateValue("primaryContactEmail", event.currentTarget.value)}
        />
        <TextInput
          label="Billing contact email"
          type="email"
          value={values.billingContactEmail ?? ""}
          error={fieldErrors.billingContactEmail}
          onChange={(event) => updateValue("billingContactEmail", event.currentTarget.value)}
        />
        <Group grow align="flex-start">
          <TextInput
            label="Country"
            value={values.country}
            error={fieldErrors.country}
            required
            onChange={(event) => updateValue("country", event.currentTarget.value)}
          />
          <TextInput
            label="State/region"
            value={values.region ?? ""}
            error={fieldErrors.region}
            onChange={(event) => updateValue("region", event.currentTarget.value)}
          />
        </Group>
        <Group grow align="flex-start">
          <TextInput
            label="City"
            value={values.city ?? ""}
            error={fieldErrors.city}
            onChange={(event) => updateValue("city", event.currentTarget.value)}
          />
          <TextInput
            label="Postal code"
            value={values.postalCode ?? ""}
            error={fieldErrors.postalCode}
            onChange={(event) => updateValue("postalCode", event.currentTarget.value)}
          />
        </Group>
        <TextInput
          label="Business address line 1"
          value={values.addressLine1 ?? ""}
          error={fieldErrors.addressLine1}
          onChange={(event) => updateValue("addressLine1", event.currentTarget.value)}
        />
        <TextInput
          label="Business address line 2"
          value={values.addressLine2 ?? ""}
          error={fieldErrors.addressLine2}
          onChange={(event) => updateValue("addressLine2", event.currentTarget.value)}
        />
        <Textarea
          label="Company description"
          value={values.description ?? ""}
          error={fieldErrors.description}
          autosize
          minRows={4}
          onChange={(event) => updateValue("description", event.currentTarget.value)}
        />

        <Button type="submit" loading={saveCompanyMutation.isPending}>
          Save company profile
        </Button>
      </Stack>
    </Paper>
  );

  function updateValue<Field extends keyof CompanyProfileFormValues>(
    field: Field,
    value: CompanyProfileFormValues[Field]
  ) {
    setValues((current) => ({
      ...current,
      [field]: value
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined
    }));
    setSaved(false);
  }
}

function companyToFormValues(company: Company | null): CompanyProfileFormValues {
  if (!company) {
    return { ...emptyValues };
  }

  return {
    legalName: company.legalName,
    displayName: company.displayName ?? "",
    companyType: toCompanyTypeValue(company.companyType),
    primaryContactName: company.primaryContactName,
    primaryContactEmail: company.primaryContactEmail,
    billingContactEmail: company.billingContactEmail ?? "",
    country: company.country,
    region: company.region ?? "",
    city: company.city ?? "",
    postalCode: company.postalCode ?? "",
    addressLine1: company.addressLine1 ?? "",
    addressLine2: company.addressLine2 ?? "",
    description: company.description ?? ""
  };
}

function zodFieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string") {
      errors[field as keyof CompanyProfileFormValues] = issue.message;
    }
  }

  return errors;
}

function toCompanyTypeValue(value: string | null): CompanyTypeValue | null {
  return companyTypeValues.includes(value as CompanyTypeValue) ? (value as CompanyTypeValue) : null;
}

function getApiValidationError(error: unknown): {
  message: string;
  fields?: FieldErrors;
} {
  if (error instanceof ApiError && isApiErrorBody(error.body)) {
    return {
      message: error.body.error.message,
      fields: error.body.error.fields as FieldErrors | undefined
    };
  }

  return {
    message: "Company profile could not be saved."
  };
}

function isApiErrorBody(body: unknown): body is {
  error: {
    message: string;
    fields?: Record<string, string>;
  };
} {
  return (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    body.error !== null &&
    typeof body.error === "object" &&
    "message" in body.error &&
    typeof body.error.message === "string"
  );
}
