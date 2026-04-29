import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  validateSync,
  Min,
} from 'class-validator';

// All required + optional environment variables declared as a typed class.
// NestJS validates this at startup — missing required vars throw and crash intentionally.
class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string;

  @IsNumber()
  @Min(1)
  API_PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  AUTH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '30d';

  @IsString()
  ENCRYPTION_KEY: string;

  @IsString()
  OPENROUTER_API_KEY: string;

  @IsString()
  @IsOptional()
  OPENROUTER_BASE_URL: string = 'https://openrouter.ai/api/v1';

  @IsString()
  @IsOptional()
  MODEL_FREE: string = 'tencent/hy3-preview:free';

  @IsString()
  @IsOptional()
  MODEL_STARTER: string = 'deepseek/deepseek-chat-v3-0324';

  @IsString()
  @IsOptional()
  MODEL_FALLBACK: string = 'deepseek/deepseek-chat-v3-0324';

  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET: string;

  @IsString()
  @IsOptional()
  STRIPE_STARTER_PRICE_ID: string;

  @IsString()
  @IsOptional()
  WEB_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  API_URL: string = 'http://localhost:3001';

  @IsString()
  @IsOptional()
  RESEND_API_KEY: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM: string = 'noreply@empleadoia.com';
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n')}`,
    );
  }

  return validatedConfig;
}
