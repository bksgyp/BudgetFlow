import { z } from "zod";

import type { TemplateField } from "@/lib/domain";

export const templateFieldSchema = z.enum([
  "transactionDate",
  "vendorName",
  "businessNumber",
  "accountTitle",
  "summary",
  "supplyAmount",
  "vatAmount",
  "totalAmount",
  "evidenceType",
  "paymentMethod",
] satisfies [TemplateField, ...TemplateField[]]);

export const projectTemplateUploadSchema = z.object({
  projectId: z.string().min(1),
  fileName: z
    .string()
    .trim()
    .min(1, "파일명을 확인할 수 없습니다.")
    .regex(/\.(xlsx|xls)$/i, "엑셀 파일만 업로드할 수 있습니다."),
});

export const templateMappingSchema = z.object({
  sourceColumn: z.string().trim().min(1),
  targetField: templateFieldSchema,
  confidence: z.number().min(0).max(1),
  confirmed: z.boolean(),
});

export const templateMappingConfirmSchema = z.object({
  projectId: z.string().min(1),
  mappings: z.array(templateMappingSchema).min(1),
});

export type ProjectTemplateUploadInput = z.input<
  typeof projectTemplateUploadSchema
>;
export type TemplateMappingConfirmInput = z.input<
  typeof templateMappingConfirmSchema
>;
