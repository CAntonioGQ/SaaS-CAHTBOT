import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsEnum } from 'class-validator';
import { AgentStatus } from '@prisma/client';

class SetStatusDto {
  @IsEnum(AgentStatus)
  status: AgentStatus;
}

@ApiTags('Agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all agents for the org' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get agent by ID' })
  findOne(@Param('agentId') agentId: string) {
    return this.service.findOne(agentId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create new AI agent' })
  create(@Body() dto: CreateAgentDto) {
    return this.service.create(dto);
  }

  @Patch(':agentId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update agent config' })
  update(@Param('agentId') agentId: string, @Body() dto: UpdateAgentDto) {
    return this.service.update(agentId, dto);
  }

  @Patch(':agentId/status')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Activate or deactivate agent' })
  setStatus(@Param('agentId') agentId: string, @Body() dto: SetStatusDto) {
    return this.service.setStatus(agentId, dto.status);
  }

  @Delete(':agentId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Soft-delete agent (sets status to INACTIVE)' })
  remove(@Param('agentId') agentId: string) {
    return this.service.remove(agentId);
  }

  @Get(':agentId/stats')
  @ApiOperation({ summary: 'Get agent metrics for last 30 days' })
  getStats(@Param('agentId') agentId: string) {
    return this.service.getStats(agentId);
  }
}
