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
  private readonly usedImages = new Set<string>(); // Запоминаем использованные изображения

  constructor(private configService: ConfigService) {}

  /**
   * Получить случайное изображение через API сервис
   */
  async getRandomImage(imageData: ApiImageData): Promise<Buffer | null> {
    try {
      // Очищаем старые изображения если накопилось много (больше 100)
      if (this.usedImages.size > 100) {
        this.usedImages.clear();
        this.logger.log('🗑️ Очищены старые использованные изображения');
      }
      
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

      this.logger.log(`🔍 Unsplash поиск: "${query}"`);

      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query,
          orientation: 'squarish',
          per_page: 10,
          page: 1, // Всегда первая страница
          content_filter: 'high'
        },
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        },
        timeout: 10000
      });

      this.logger.log(`📊 Unsplash статус: ${response.status}, найдено: ${response.data?.results?.length || 0} изображений`);

      if (response.data?.results?.length > 0) {
        // Фильтруем уже использованные изображения
        const availableImages = response.data.results.filter(img => !this.usedImages.has(img.id));
        
        if (availableImages.length === 0) {
          this.logger.warn('Все изображения из Unsplash использованы, пробуем другой API');
          return null;
        }
        
        // Выбираем случайное изображение из доступных
        const randomImage = availableImages[Math.floor(Math.random() * availableImages.length)];
        const imageUrl = randomImage.urls?.regular;
        
        // Запоминаем ID использованного изображения
        this.usedImages.add(randomImage.id);
        
        this.logger.log(`✅ Unsplash выбрано изображение ID: ${randomImage.id}`);
        
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
      if (error.response?.status === 404) {
        this.logger.error(`❌ Unsplash 404: Изображения не найдены по запросу, пробуем fallback`);
        // Пробуем универсальный запрос
        return this.tryUnsplashFallback(imageData);
      } else if (error.response?.status === 401) {
        this.logger.error('❌ Unsplash 401: Неверный API ключ');
      } else if (error.response?.status === 403) {
        this.logger.error('❌ Unsplash 403: Лимит API исчерпан');
      } else {
        this.logger.error(`❌ Unsplash API ошибка: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Fallback для Unsplash с универсальными запросами
   */
  private async tryUnsplashFallback(imageData: ApiImageData): Promise<Buffer | null> {
    try {
      const fallbackQueries = ['birthday', 'celebration', 'party', 'happy', 'festive'];
      const randomQuery = fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];
      
      this.logger.log(`🔄 Unsplash fallback: "${randomQuery}"`);

      const accessKey = this.configService.get<string>('UNSPLASH_ACCESS_KEY');
      const response = await axios.get('https://api.unsplash.com/search', {
        params: {
          query: randomQuery,
          orientation: 'squarish',
          per_page: 5,
          page: Math.floor(Math.random() * 50) + 1,
          content_filter: 'high'
        },
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        },
        timeout: 10000
      });

      if (response.data?.results?.length > 0) {
        const randomImage = response.data.results[Math.floor(Math.random() * response.data.results.length)];
        const imageUrl = randomImage.urls?.regular;
        
        if (imageUrl) {
          this.usedImages.add(randomImage.id);
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          this.logger.log(`✅ Unsplash fallback успешен: ${randomImage.id}`);
          return Buffer.from(imageResponse.data);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Unsplash fallback тоже не сработал: ${error.message}`);
    }
    return null;
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
          per_page: 20, // Запрашиваем 20 изображений для максимального разнообразия
          page: Math.floor(Math.random() * 50) + 1 // Случайная страница из 50
        },
        headers: {
          'Authorization': apiKey
        },
        timeout: 10000
      });

      if (response.data?.photos?.length > 0) {
        // Фильтруем уже использованные изображения
        const availablePhotos = response.data.photos.filter(photo => !this.usedImages.has(photo.id));
        
        if (availablePhotos.length === 0) {
          this.logger.warn('Все изображения из Pexels использованы, пробуем другой API');
          return null;
        }
        
        // Выбираем случайное изображение из доступных
        const randomPhoto = availablePhotos[Math.floor(Math.random() * availablePhotos.length)];
        const imageUrl = randomPhoto.src?.large;
        
        // Запоминаем ID использованного изображения
        this.usedImages.add(randomPhoto.id);
        
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
          per_page: 30, // Увеличим до 30 для больше результатов
          page: 1 // Всегда первая страница
        },
        timeout: 10000
      });

      if (response.data?.hits?.length > 0) {
        // Фильтруем уже использованные изображения
        const availableHits = response.data.hits.filter(hit => !this.usedImages.has(hit.id));
        
        if (availableHits.length === 0) {
          this.logger.warn('Все изображения из Pixabay использованы, пробуем другой API');
          return null;
        }
        
        // Выбираем случайное изображение из доступных
        const randomHit = availableHits[Math.floor(Math.random() * availableHits.length)];
        const imageUrl = randomHit.largeImageURL;
        
        // Запоминаем ID использованного изображения
        this.usedImages.add(randomHit.id);
        
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

    // Универсальные простые запросы на английском
    const universalQueries = [
      'birthday celebration',
      'party celebration', 
      'happy birthday',
      'celebration party',
      'birthday cake',
      'festive celebration',
      'party decorations',
      'birthday balloons',
      'celebration confetti',
      'happy celebration'
    ];

    // Простой fallback если ничего не найдено
    const fallbackQueries = [
      'celebration',
      'party',
      'happy',
      'birthday',
      'festive'
    ];

    const queries = {
      'День рождения': {
        [GreetingStyle.OFFICIAL]: [
          'elegant birthday celebration',
          'formal birthday party',
          'sophisticated birthday cake'
        ],
        [GreetingStyle.FUNNY]: [
          'fun birthday party',
          'happy birthday balloons',
          'birthday celebration fun'
        ],
        [GreetingStyle.POETIC]: [
          'beautiful birthday',
          'romantic birthday',
          'dreamy birthday celebration'
        ],
        [GreetingStyle.FRIENDLY]: [
          'happy birthday',
          'birthday celebration',
          'birthday party friends'
        ],
        [GreetingStyle.ROMANTIC]: [
          'romantic birthday',
          'intimate birthday',
          'elegant birthday dinner'
        ]
      },
      '8 марта': {
        [GreetingStyle.OFFICIAL]: [
          'international women day',
          'women day flowers',
          'formal women day'
        ],
        [GreetingStyle.FUNNY]: [
          'women day celebration',
          'happy women day',
          'women day party'
        ],
        [GreetingStyle.POETIC]: [
          'beautiful women day',
          'romantic women day',
          'women day spring flowers'
        ],
        [GreetingStyle.FRIENDLY]: [
          'happy women day',
          'women day celebration',
          'women day spring'
        ],
        [GreetingStyle.ROMANTIC]: [
          'romantic women day',
          'women day roses',
          'elegant women day'
        ]
      },
      'Новый год': {
        [GreetingStyle.OFFICIAL]: [
          'elegant new year',
          'formal new year',
          'sophisticated new year'
        ],
        [GreetingStyle.FUNNY]: [
          'fun new year party',
          'happy new year',
          'new year celebration'
        ],
        [GreetingStyle.POETIC]: [
          'magical new year',
          'dreamy winter new year',
          'romantic new year'
        ],
        [GreetingStyle.FRIENDLY]: [
          'happy new year',
          'new year celebration',
          'new year family'
        ],
        [GreetingStyle.ROMANTIC]: [
          'romantic new year',
          'intimate new year',
          'elegant new year dinner'
        ]
      }
    };

    // 1. Пытаемся найти по конкретному запросу
    const holidayQueries = queries[holiday]?.[style];
    if (holidayQueries && holidayQueries.length > 0) {
      const randomQuery = holidayQueries[Math.floor(Math.random() * holidayQueries.length)];
      return randomQuery;
    }

    // 2. Fallback на универсальные запросы
    const randomUniversal = universalQueries[Math.floor(Math.random() * universalQueries.length)];
    return randomUniversal;
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
