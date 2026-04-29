import { Controller, Get, Patch, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AppointmentsService } from './appointments.service';
import { AppointmentStatus } from '@prisma/client';

class UpdateStatusDto {
  @IsEnum(AppointmentStatus) status: AppointmentStatus;
}

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  findAll(
    @Query('status') status?: AppointmentStatus,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(status, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }
}
