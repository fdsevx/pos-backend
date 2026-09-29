import { z } from "zod";

export const openShiftSchema = z.object({
  device_id: z.string().min(1),
  cash_opening: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const closeShiftSchema = z.object({
  shift_id: z.string().uuid(),
  cash_closing: z.string().regex(/^\d+(\.\d{1,2})?$/),
  notes: z.string().optional(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
