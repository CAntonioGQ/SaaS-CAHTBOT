import {
  Controller, Get, Post, Param, Query, Body, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ConversationsService } from './conversations.service';

class EscalateDto {
  @IsString() @IsOptional() reason?: string;
}

class AssignDto {
  @IsString() memberId: string;
}

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  findAll(
    @Query('status') status?: string,
    @Query('agentId') agentId?: string,
    @Query('assignedMemberId') assignedMemberId?: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.findAll({ status, agentId, assignedMemberId, limit, cursor });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/escalate')
  @HttpCode(HttpStatus.OK)
  escalate(@Param('id') id: string, @Body() dto: EscalateDto) {
    return this.service.escalate(id, dto.reason);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.service.assign(id, dto.memberId);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@Param('id') id: string) {
    return this.service.resolve(id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  // SSE endpoint — frontend subscribes to get realtime inbox updates
  // Event: data: { type, conversationId, payload }
  @Get('stream')
  @ApiOperation({ summary: 'SSE stream for realtime inbox updates' })
  stream(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering

    // Send initial heartbeat
    res.write('data: {"type":"connected"}\n\n');

    // Heartbeat every 30s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      res.write('data: {"type":"heartbeat"}\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(heartbeat);
    });
  }
}
