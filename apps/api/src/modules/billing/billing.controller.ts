import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { BillingService } from './billing.service';

class CreateCheckoutDto {
  @IsString() planId: string;
}

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('plans')
  getPlans() {
    return this.service.getPlans();
  }

  @Get('subscription')
  getSubscription() {
    return this.service.getSubscription();
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  createCheckout(@Body() dto: CreateCheckoutDto) {
    return this.service.createCheckoutSession(dto.planId);
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  createPortal() {
    return this.service.createPortalSession();
  }
}
