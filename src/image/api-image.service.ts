import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface ApiImageData {
  name: string;
  style?: string;
  recipientName?: string;
  recipientInfo?: {
    age?: number;
    gender?: 'male' | 'female';
    interests?: string[];
  };
}

@Injectable()
export class ApiImageService {
  private readonly logger = new Logger(ApiImageService.name);

  constructor(private configService: ConfigService) {}

  async getRandomImage(imageData: ApiImageData): Promise<Buffer> {
    this.logger.log(`🖼️ Генерация изображения для: ${imageData.name}`);

    // 1. Пробуем Unsplash (random endpoint)
    try {
      const unsplashImage = await this.getFromUnsplash(imageData);
      if (unsplashImage) {
        this.logger.log('✅ Изображение получено через Unsplash');
        return unsplashImage;
      }
    } catch (error) {
      this.logger.warn('❌ Unsplash не сработал:', error.message);
    }

    // 2. Пробуем Pexels (random page)
    try {
      const pexelsImage = await this.getFromPexels(imageData);
      if (pexelsImage) {
        this.logger.log('✅ Изображение получено через Pexels');
        return pexelsImage;
      }
    } catch (error) {
      this.logger.warn('❌ Pexels не сработал:', error.message);
    }

    // 3. Пробуем Pixabay (random page, случайный из 3)
    try {
      const pixabayImage = await this.getFromPixabay(imageData);
      if (pixabayImage) {
        this.logger.log('✅ Изображение получено через Pixabay');
        return pixabayImage;
      }
    } catch (error) {
      this.logger.warn('❌ Pixabay не сработал:', error.message);
    }

    throw new Error('Не удалось получить изображение ни через один из API');
  }

  /**
   * Получение случайного изображения из Unsplash
   */
  private async getFromUnsplash(imageData: ApiImageData): Promise<Buffer | null> {
    const accessKey = this.configService.get<string>('UNSPLASH_ACCESS_KEY');
    if (!accessKey) {
      this.logger.warn('UNSPLASH_ACCESS_KEY не настроен');
      return null;
    }

    try {
      const query = this.getSearchQuery(imageData);
      this.logger.log(`🔍 Unsplash случайный поиск: "${query}"`);

      const response = await axios.get('https://api.unsplash.com/photos/random', {
        params: {
          query,
          orientation: 'squarish',
          content_filter: 'high',
          count: 1
        },
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        },
        timeout: 10000
      });

      if (response.status !== 200 || !response.data || response.data.length === 0) {
        this.logger.warn(`Unsplash вернул пустой ответ: ${response.status}`);
        return null;
      }

      const photo = response.data[0] || response.data;
      if (!photo || !photo.urls) {
        this.logger.warn('Unsplash: нет данных о фото');
        return null;
      }

      const imageUrl = photo.urls.regular;
      if (!imageUrl) {
        this.logger.warn('Unsplash: нет URL изображения');
        return null;
      }

      this.logger.log(`📊 Unsplash выбрано изображение ID: ${photo.id}`);

      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000
      });

      return Buffer.from(imageResponse.data);

    } catch (error) {
      this.logger.error('Unsplash ошибка:', error.message);
      if (error.response?.status === 401) {
        this.logger.error('Unsplash: неверный API ключ');
      } else if (error.response?.status === 403) {
        this.logger.error('Unsplash: превышен лимит запросов');
      } else if (error.response?.status === 404) {
        this.logger.warn('Unsplash: изображения не найдены');
      }
      return null;
    }
  }

  /**
   * Получение изображения из Pexels (случайная страница)
   */
  private async getFromPexels(imageData: ApiImageData): Promise<Buffer | null> {
    const apiKey = this.configService.get<string>('PEXELS_API_KEY');
    if (!apiKey) {
      this.logger.warn('PEXELS_API_KEY не настроен');
      return null;
    }

    try {
      const query = this.getSearchQuery(imageData);
      const randomPage = Math.floor(Math.random() * 100) + 1;
      
      this.logger.log(`🔍 Pexels поиск: "${query}" (страница: ${randomPage})`);

      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: {
          query,
          orientation: 'square',
          per_page: 1,
          page: randomPage
        },
        headers: {
          'Authorization': apiKey
        },
        timeout: 10000
      });

      if (response.status !== 200 || !response.data?.photos || response.data.photos.length === 0) {
        this.logger.warn(`Pexels вернул пустой ответ: ${response.status}`);
        return null;
      }

      const photo = response.data.photos[0];
      if (!photo || !photo.src) {
        this.logger.warn('Pexels: нет данных о фото');
        return null;
      }

      const imageUrl = photo.src.large;
      if (!imageUrl) {
        this.logger.warn('Pexels: нет URL изображения');
        return null;
      }

      this.logger.log(`📊 Pexels выбрано изображение ID: ${photo.id}`);

      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000
      });

      return Buffer.from(imageResponse.data);

    } catch (error) {
      this.logger.error('Pexels ошибка:', error.message);
      if (error.response?.status === 401) {
        this.logger.error('Pexels: неверный API ключ');
      } else if (error.response?.status === 429) {
        this.logger.error('Pexels: превышен лимит запросов');
      }
      return null;
    }
  }

  /**
   * Получение изображения из Pixabay (случайная страница, случайный из 3)
   */
  private async getFromPixabay(imageData: ApiImageData): Promise<Buffer | null> {
    const apiKey = this.configService.get<string>('PIXABAY_API_KEY');
    if (!apiKey) {
      this.logger.warn('PIXABAY_API_KEY не настроен');
      return null;
    }

    try {
      const query = this.getSearchQuery(imageData);
      const randomPage = Math.floor(Math.random() * 100) + 1;
      
      this.logger.log(`🔍 Pixabay поиск: "${query}" (страница: ${randomPage})`);

      const response = await axios.get('https://pixabay.com/api/', {
        params: {
          key: apiKey,
          q: query,
          image_type: 'photo',
          orientation: 'vertical',
          category: 'celebrations',
          safesearch: true,
          per_page: 3,
          page: randomPage
        },
        timeout: 10000
      });

      if (response.status !== 200 || !response.data?.hits || response.data.hits.length === 0) {
        this.logger.warn(`Pixabay вернул пустой ответ: ${response.status}`);
        return null;
      }

      // Берем случайный из 3 результатов
      const randomIndex = Math.floor(Math.random() * Math.min(3, response.data.hits.length));
      const photo = response.data.hits[randomIndex];
      
      if (!photo || !photo.webformatURL) {
        this.logger.warn('Pixabay: нет данных о фото');
        return null;
      }

      const imageUrl = photo.webformatURL;
      if (!imageUrl) {
        this.logger.warn('Pixabay: нет URL изображения');
        return null;
      }

      this.logger.log(`📊 Pixabay выбрано изображение ID: ${photo.id} (индекс: ${randomIndex})`);

      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000
      });

      return Buffer.from(imageResponse.data);

    } catch (error) {
      this.logger.error('Pixabay ошибка:', error.message);
      if (error.response?.status === 401) {
        this.logger.error('Pixabay: неверный API ключ');
      } else if (error.response?.status === 429) {
        this.logger.error('Pixabay: превышен лимит запросов');
      } else if (error.response?.status === 400) {
        this.logger.warn('Pixabay: неверные параметры запроса');
      }
      return null;
    }
  }

  /**
   * Получение поискового запроса на основе праздника и стиля
   */
  private getSearchQuery(imageData: ApiImageData): string {
    const holiday = imageData.name;
    const style = imageData.style || 'friendly';

    const queries = {
      'День рождения': {
        'friendly': ['happy birthday celebration', 'birthday party colorful', 'festive birthday decorations'],
        'official': ['elegant birthday celebration', 'formal birthday party', 'sophisticated birthday event'],
        'funny': ['funny birthday party', 'silly birthday celebration', 'humorous birthday decorations'],
        'poetic': ['romantic birthday scene', 'dreamy birthday celebration', 'artistic birthday decorations'],
        'romantic': ['romantic birthday dinner', 'intimate birthday celebration', 'candlelight birthday setting']
      },
      '8 марта': {
        'friendly': ['international women day celebration', '8 march flowers', 'women day festive'],
        'official': ['formal women day celebration', 'elegant 8 march event', 'professional women day'],
        'funny': ['funny women day celebration', 'playful 8 march party', 'cheerful women day'],
        'poetic': ['romantic women day scene', 'beautiful 8 march flowers', 'artistic women day celebration'],
        'romantic': ['romantic women day flowers', 'intimate 8 march setting', 'elegant women day celebration']
      },
      'Новый год': {
        'friendly': ['new year celebration', 'festive new year party', 'happy new year decorations'],
        'official': ['formal new year celebration', 'elegant new year event', 'professional new year'],
        'funny': ['funny new year party', 'playful new year celebration', 'cheerful new year'],
        'poetic': ['magical new year scene', 'dreamy new year celebration', 'artistic new year decorations'],
        'romantic': ['romantic new year setting', 'intimate new year celebration', 'cozy new year atmosphere']
      },
      'Пасха': {
        'friendly': ['easter celebration', 'festive easter party', 'happy easter decorations'],
        'official': ['formal easter celebration', 'elegant easter event', 'traditional easter'],
        'funny': ['funny easter celebration', 'playful easter party', 'cheerful easter'],
        'poetic': ['beautiful easter scene', 'dreamy easter celebration', 'artistic easter decorations'],
        'romantic': ['romantic easter setting', 'intimate easter celebration', 'elegant easter atmosphere']
      }
    };

    // 1. Пытаемся найти по конкретному запросу
    const holidayQueries = queries[holiday]?.[style];
    if (holidayQueries && holidayQueries.length > 0) {
      const randomQuery = holidayQueries[Math.floor(Math.random() * holidayQueries.length)];
      return randomQuery;
    }

    // 2. Fallback на универсальные запросы
    const universalQueries = [
      'celebration party festive',
      'happy holiday celebration',
      'festive decorations colorful',
      'joyful celebration atmosphere'
    ];
    const randomUniversal = universalQueries[Math.floor(Math.random() * universalQueries.length)];
    return randomUniversal;
  }
}
