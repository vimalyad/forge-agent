export const Type = {
  OBJECT: "object",
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  ARRAY: "array",
} as const;

export type SchemaType = (typeof Type)[keyof typeof Type];

export type FunctionSchema = {
  type?: SchemaType;
  description?: string;
  properties?: Record<string, FunctionSchema>;
  required?: string[];
  items?: FunctionSchema;
};

export type FunctionDeclaration = {
  name?: string;
  description?: string;
  parameters?: FunctionSchema;
};
