import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GreetingStyle } from '../ai/ai.service';

export interface ApiImageData {
  name: string;
  recipientName?: string;
  style?: GreetingStyle;
}

@Injectable()
export class ApiImageService {
  private readonly logger = new Logger(ApiImageService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Получить случайное изображение через API сервис
   */
  async getRandomImage(imageData: ApiImageData): Promise<Buffer | null> {
    try {
      // 1. Unsplash API (бесплатные красивые изображения)
      const unsplashImage = await this.getFromUnsplash(imageData);
      if (unsplashImage) {
        this.logger.log('✅ Изображение получено через Unsplash');
        return unsplashImage;
      }

      // 2. Pexels API (бесплатные стоковые фото)
      const pexelsImage = await this.getFromPexels(imageData);
      if (pexelsImage) {
        this.logger.log('✅ Изображение получено через Pexels');
        return pexelsImage;
      }

      // 3. Pixabay API (бесплатные изображения)
      const pixabayImage = await this.getFromPixabay(imageData);
      if (pixabayImage) {
        this.logger.log('✅ Изображение получено через Pixabay');
        return pixabayImage;
      }

      return null;
    } catch (error) {
      this.logger.error('❌ Ошибка получения изображения через API:', error);
      return null;
    }
  }

  /**
   * Unsplash API - бесплатные качественные изображения
   */
  private async getFromUnsplash(imageData: ApiImageData): Promise<Buffer | null> {
    try {
      const query = this.getSearchQuery(imageData);
      const accessKey = this.configService.get<string>('UNSPLASH_ACCESS_KEY');
      
      if (!accessKey) {
        this.logger.warn('UNSPLASH_ACCESS_KEY не настроен');
        return null;
      }

      const response = await axios.get('https://api.unsplash.com/photos/random', {
        params: {
          query,
          orientation: 'squarish',
          count: 1,
          content_filter: 'high'
        },
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        const imageUrl = response.data[0].urls?.regular;
        if (imageUrl) {
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          return Buffer.from(imageResponse.data);
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Unsplash API ошибка:', error.message);
      return null;
    }
  }

  /**
   * Pexels API - бесплатные стоковые фотографии
   */
  private async getFromPexels(imageData: ApiImageData): Promise<Buffer | null> {
    try {
      const query = this.getSearchQuery(imageData);
      const apiKey = this.configService.get<string>('PEXELS_API_KEY');
      
      if (!apiKey) {
        this.logger.warn('PEXELS_API_KEY не настроен');
        return null;
      }

      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: {
          query,
          orientation: 'square',
          per_page: 1,
          page: Math.floor(Math.random() * 10) + 1
        },
        headers: {
          'Authorization': apiKey
        },
        timeout: 10000
      });

      if (response.data?.photos?.length > 0) {
        const imageUrl = response.data.photos[0].src?.large;
        if (imageUrl) {
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          return Buffer.from(imageResponse.data);
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Pexels API ошибка:', error.message);
      return null;
    }
  }

  /**
   * Pixabay API - бесплатные изображения
   */
  private async getFromPixabay(imageData: ApiImageData): Promise<Buffer | null> {
    try {
      const query = this.getSearchQuery(imageData);
      const apiKey = this.configService.get<string>('PIXABAY_API_KEY');
      
      if (!apiKey) {
        this.logger.warn('PIXABAY_API_KEY не настроен');
        return null;
      }

      const response = await axios.get('https://pixabay.com/api/', {
        params: {
          key: apiKey,
          q: query,
          image_type: 'photo',
          orientation: 'vertical',
          category: 'celebrations',
          safesearch: true,
          per_page: 3,
          page: Math.floor(Math.random() * 5) + 1
        },
        timeout: 10000
      });

      if (response.data?.hits?.length > 0) {
        const imageUrl = response.data.hits[0].largeImageURL;
        if (imageUrl) {
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          return Buffer.from(imageResponse.data);
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Pixabay API ошибка:', error.message);
      return null;
    }
  }

  /**
   * Получить поисковый запрос на основе праздника и стиля
   */
  private getSearchQuery(imageData: ApiImageData): string {
    const holiday = imageData.name;
    const style = imageData.style || GreetingStyle.FRIENDLY;

    const queries = {
      'День рождения': {
        [GreetingStyle.OFFICIAL]: 'elegant birthday celebration formal cake',
        [GreetingStyle.FUNNY]: 'funny birthday party colorful balloons',
        [GreetingStyle.POETIC]: 'beautiful birthday flowers romantic',
        [GreetingStyle.FRIENDLY]: 'happy birthday celebration friends',
        [GreetingStyle.ROMANTIC]: 'romantic birthday dinner candles'
      },
      '8 марта': {
        [GreetingStyle.OFFICIAL]: 'international women day elegant flowers',
        [GreetingStyle.FUNNY]: 'women day celebration colorful spring',
        [GreetingStyle.POETIC]: 'beautiful spring flowers women day',
        [GreetingStyle.FRIENDLY]: 'happy women day celebration',
        [GreetingStyle.ROMANTIC]: 'romantic women day roses'
      },
      'Новый год': {
        [GreetingStyle.OFFICIAL]: 'elegant new year celebration formal',
        [GreetingStyle.FUNNY]: 'funny new year party celebration',
        [GreetingStyle.POETIC]: 'magical new year snow winter',
        [GreetingStyle.FRIENDLY]: 'happy new year family celebration',
        [GreetingStyle.ROMANTIC]: 'romantic new year candles'
      }
    };

    return queries[holiday]?.[style] || 'celebration party festive';
  }

  /**
   * Проверить доступность API сервисов
   */
  async checkApiAvailability(): Promise<{ unsplash: boolean; pexels: boolean; pixabay: boolean }> {
    const result = {
      unsplash: !!this.configService.get<string>('UNSPLASH_ACCESS_KEY'),
      pexels: !!this.configService.get<string>('PEXELS_API_KEY'),
      pixabay: !!this.configService.get<string>('PIXABAY_API_KEY')
    };

    this.logger.log('🔑 Статус API ключей:', result);
    return result;
  }
}
