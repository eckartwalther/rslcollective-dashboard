import { Alert, Button, Card, Select, SimpleGrid, Stack, TextInput, Textarea } from "@mantine/core";
import { FormEvent, useEffect, useState } from "react";
import { ZodError } from "zod";
import { ApiError } from "../../api/client";
import { type Company, useSaveCompanyMutation } from "../../api/company";
import {
  companyProfileSchema,
  companyTypeValues
} from "../../schemas/company";
import { FormSection } from "./FormSection";

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
    <Card component="form" withBorder radius="sm" p="md" noValidate onSubmit={handleSubmit}>
      <Stack gap="lg">
        {saved ? (
          <Alert color="green" title="Publisher profile saved">
            Your publisher profile has been saved.
          </Alert>
        ) : null}
        {formMessage ? (
          <Alert color="red" title="Publisher profile could not be saved">
          {formMessage}
          </Alert>
        ) : null}

        <FormSection
          title="Company identity"
          description="Core publisher identity details for the profile record."
          withDivider={false}
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Legal publisher name"
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
              label="Publisher type"
              data={[...companyTypeValues]}
              value={values.companyType ?? null}
              error={fieldErrors.companyType}
              clearable
              onChange={(value) => updateValue("companyType", toCompanyTypeValue(value))}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection
          title="Primary contact"
          description="Main representative contact for this publisher profile."
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
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
          </SimpleGrid>
        </FormSection>

        <FormSection
          title="Address"
          description="Basic business address details for the publisher profile."
        >
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
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
            </SimpleGrid>
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
          </Stack>
        </FormSection>

        <FormSection
          title="Description"
          description="Optional short context about the company."
        >
          <Textarea
            label="Publisher description"
            value={values.description ?? ""}
            error={fieldErrors.description}
            autosize
            minRows={4}
            onChange={(event) => updateValue("description", event.currentTarget.value)}
          />
        </FormSection>

        <Button type="submit" loading={saveCompanyMutation.isPending} w="fit-content">
          Save publisher profile
        </Button>
      </Stack>
    </Card>
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
      message: publisherProfileMessage(error.body.error.message),
      fields: error.body.error.fields as FieldErrors | undefined
    };
  }

  return {
    message: "Publisher profile could not be saved."
  };
}

function publisherProfileMessage(message: string) {
  return message
    .replaceAll("Company profile", "Publisher profile")
    .replaceAll("company profile", "publisher profile");
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
