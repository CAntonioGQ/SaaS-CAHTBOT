import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() makes PrismaService available everywhere without re-importing.
// Same as providedIn: 'root' in Angular services.
// This way every feature module can inject PrismaService without listing it in imports.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
