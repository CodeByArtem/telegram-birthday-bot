import { Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { ApiImageService } from './api-image.service';

@Module({
  providers: [ImageService, ApiImageService],
  exports: [ImageService, ApiImageService],
})
export class ImageModule {}
