import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly groq: Groq;

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
        model: 'llama-3.1-8b-instant', // Обновленная модель
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
        model: 'llama-3.1-8b-instant', // Обновленная модель
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      this.logger.warn('Groq API недоступен:', error.message);
      return false;
    }
  }
}
