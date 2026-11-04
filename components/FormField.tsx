import { Field, Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";

// Label + input + error (or helper text). Keeps the long forms readable.
// `labelEnd` sits at the right of the label row (e.g. a "Forgot password?" link).
export function FormField({
  label,
  error,
  helper,
  required = true,
  labelEnd,
  children,
}: {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  labelEnd?: ReactNode;
  children: ReactNode;
}) {
  const labelEl = (
    <Field.Label>
      {label} {required && <Field.RequiredIndicator />}
    </Field.Label>
  );
  return (
    <Field.Root required={required} invalid={!!error}>
      {labelEnd ? (
        <Flex w="full" justify="space-between" align="baseline" gap="3">
          {labelEl}
          {labelEnd}
        </Flex>
      ) : (
        labelEl
      )}
      {children}
      {error ? <Field.ErrorText>{error}</Field.ErrorText> : helper && <Field.HelperText>{helper}</Field.HelperText>}
    </Field.Root>
  );
}
