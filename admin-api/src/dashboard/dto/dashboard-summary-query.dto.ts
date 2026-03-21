import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';

export const DASHBOARD_SALES_PRESETS = ['7d', '30d', 'month', 'custom'] as const;

export type DashboardSalesPreset = (typeof DASHBOARD_SALES_PRESETS)[number];

export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsIn(DASHBOARD_SALES_PRESETS)
  salesPreset?: DashboardSalesPreset;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}