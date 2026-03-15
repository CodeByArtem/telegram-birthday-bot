import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GreetingStyle, GreetingLanguage } from './ai.service';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly groq: Groq;
  private promptCache = new Map<string, string>(); // Кэш промптов

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY не настроен');
    }
    this.groq = new Groq({ apiKey });
  }

  /**
   * Генерация текста поздравления через Groq
   */
  async generateGreetingText(
    recipientName: string,
    holiday: string,
    style: string = 'friendly',
    language: string = 'russian'
  ): Promise<string> {
    try {
      const prompt = this.buildPrompt(recipientName, holiday, style, language);

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Ты - эксперт по написанию поздравлений. Пиши тепло, искренне и креативно.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const text = response.choices[0]?.message?.content?.trim();
      
      if (!text) {
        throw new Error('Groq вернул пустой ответ');
      }

      this.logger.log(`✅ Groq сгенерировал текст поздравления (${text.length} символов)`);
      return text;

    } catch (error) {
      this.logger.error('❌ Ошибка генерации текста через Groq:', error.message);
      throw error;
    }
  }

  /**
   * Генерация промпта для изображений через Groq
   */
  async generateImagePrompt(
    holiday: string,
    style: string = 'friendly',
    language: string = 'russian'
  ): Promise<string> {
    try {
      // Проверяем кэш
      const cacheKey = `${holiday}-${style}-${language}`;
      if (this.promptCache.has(cacheKey)) {
        this.logger.log(`📋 Использую кэшированный промпт для ${holiday}`);
        return this.promptCache.get(cacheKey)!;
      }

      const prompt = `Сгенерируй промпт для AI генерации изображения на тему "${holiday}" в стиле "${style}" на ${language} языке.

Требования:
- Детальное описание сцены
- Упоминание цветов, настроения
- Профессиональные термины (digital art, high resolution, detailed)
- Длина: 50-100 слов
- Без упоминания людей в промпте

Пример ответа:
"Masterful digital art with ultra-detailed illustration, vibrant birthday celebration, colorful balloons and confetti, warm lighting, high resolution, professional photography style"`;

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Ты - эксперт по AI промптам для генерации изображений. Создавай детальные и профессиональные промпты.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.5
      });

      const generatedPrompt = response.choices[0]?.message?.content?.trim();
      
      if (!generatedPrompt) {
        throw new Error('Groq вернул пустой промпт');
      }

      // Сохраняем в кэш
      this.promptCache.set(cacheKey, generatedPrompt);
      this.logger.log(`✅ Groq сгенерировал промпт для изображения (${generatedPrompt.length} символов)`);
      return generatedPrompt;

    } catch (error) {
      this.logger.error('❌ Ошибка генерации промпта через Groq:', error.message);
      throw error;
    }
  }

  /**
   * Построение промпта для генерации поздравления
   */
  private buildPrompt(
    recipientName: string,
    holiday: string,
    style: string,
    language: string
  ): string {
    const stylePrompts = {
      friendly: 'дружеский, теплый, неформальный',
      official: 'официальный, уважительный, сдержанный',
      funny: 'смешной, юмористический, с шутками',
      poetic: 'поэтичный, романтичный, красивый',
      romantic: 'романтичный, нежный, любовный'
    };

    const languagePrompts = {
      russian: 'Напиши на русском языке',
      english: 'Write in English'
    };

    const stylePrompt = stylePrompts[style] || stylePrompts.friendly;
    const languagePrompt = languagePrompts[language] || languagePrompts.russian;

    return `
${languagePrompt}.

Напиши поздравление с ${holiday} для ${recipientName}.

Стиль: ${stylePrompt}.

Требования:
- Длина: 2-3 предложения
- Без шаблонных фраз
- Искренне и тепло
- Уникальное поздравление

Пример:
"Дорогой ${recipientName}! Поздравляю тебя с ${holiday}! Желаю тебе счастья, здоровья и удачи во всех начинаниях!"
    `.trim();
  }

  /**
   * Проверка доступности Groq API
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      this.logger.warn('Groq API недоступен:', error.message);
      return false;
    }
  }

  /**
   * Очистка кэша промптов
   */
  clearPromptCache(): void {
    this.promptCache.clear();
    this.logger.log('🗑️ Кэш промптов очищен');
  }

  /**
   * Получение статистики кэша
   */
  getPromptCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.promptCache.size,
      keys: Array.from(this.promptCache.keys())
    };
  }
}
