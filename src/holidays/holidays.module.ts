import { Module } from '@nestjs/common';
import { HolidaysService } from './holidays.service';

@Module({
  providers: [HolidaysService],
  exports: [HolidaysService],
})
export class HolidaysModule {}
