import { PartialType } from '@nestjs/swagger';
import { CreateAgentDto } from './create-agent.dto';

// PartialType makes ALL fields of CreateAgentDto optional — standard NestJS pattern.
// In Python you'd do this with TypedDict with Optional on every field.
export class UpdateAgentDto extends PartialType(CreateAgentDto) {}
