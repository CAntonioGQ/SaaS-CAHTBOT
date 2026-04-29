import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEmail,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentTone } from '@prisma/client';

export class CreateAgentDto {
  @ApiProperty({ example: 'Sofía — Ventas' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({ enum: AgentTone, default: 'PROFESSIONAL' })
  @IsEnum(AgentTone)
  @IsOptional()
  tone?: AgentTone;

  // Full OpenRouter model ID. Examples:
  //   "tencent/hy3-preview:free" (free plan)
  //   "deepseek/deepseek-chat-v3-0324" (starter plan)
  @ApiPropertyOptional({ example: 'tencent/hy3-preview:free' })
  @IsString()
  @IsOptional()
  modelName?: string;

  @ApiPropertyOptional({ example: 'deepseek/deepseek-chat-v3-0324' })
  @IsString()
  @IsOptional()
  fallbackModelName?: string;

  @ApiProperty({ example: 'Eres Sofía, asistente de ventas de Ferretería García...' })
  @IsString()
  @MinLength(10)
  systemPrompt: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  welcomeMessage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fallbackMessage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  outsideHoursMessage?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2 })
  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ minimum: 100, maximum: 2000 })
  @IsNumber()
  @Min(100)
  @Max(2000)
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({ minimum: 5, maximum: 20 })
  @IsNumber()
  @Min(5)
  @Max(20)
  @IsOptional()
  contextMessages?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  leadCaptureEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  appointmentEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  inventoryEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  humanEscalationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  businessHours?: Record<string, { enabled: boolean; open: string; close: string }>;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  escalationKeywords?: string[];

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  escalationEmail?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000 })
  @IsNumber()
  @Min(0)
  @Max(10000)
  @IsOptional()
  responseDelayMs?: number;
}
