import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current organization' })
  getCurrent() {
    return this.service.getCurrent();
  }

  @Patch('current')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update current organization' })
  update(@Body() dto: UpdateOrganizationDto) {
    return this.service.update(dto);
  }

  @Get('members')
  @ApiOperation({ summary: 'List organization members' })
  getMembers() {
    return this.service.getMembers();
  }

  @Delete('members/:memberId')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Remove a team member' })
  removeMember(@Param('memberId') memberId: string) {
    return this.service.removeMember(memberId);
  }
}
