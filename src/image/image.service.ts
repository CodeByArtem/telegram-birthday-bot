import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { GreetingStyle } from '../ai/ai.service';

export interface HolidayImageData {
  name: string;
  recipientName?: string;
  prompt?: string;
  style?: GreetingStyle;
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  private readonly outputDir = './generated-images';

  constructor(private configService: ConfigService) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Генерация изображения
   */
  async generateImage(holidayData: HolidayImageData): Promise<Buffer> {
    try {
      this.logger.log(`Генерация изображения для: ${holidayData.name}`);

      // 1. StableHorde (бесплатно, стабильно)
      try {
        const buf = await this.generateWithStableHorde(holidayData);
        if (buf) {
          this.logger.log('✅ Изображение сгенерировано через StableHorde');
          return this.saveImage(buf, holidayData.name);
        }
      } catch (error) {
        this.logger.warn('StableHorde не сработал:', error.message);
      }

      // 2. Pollinations
      try {
        const buf = await this.generateWithPollinations(holidayData);
        if (buf) {
          this.logger.log('✅ Изображение сгенерировано через Pollinations');
          return this.saveImage(buf, holidayData.name);
        }
      } catch (error) {
        this.logger.warn('Pollinations не сработал:', error.message);
      }

      // 3. Replicate
      try {
        const buf = await this.generateWithReplicate(holidayData);
        if (buf) {
          this.logger.log('✅ Изображение сгенерировано через Replicate');
          return this.saveImage(buf, holidayData.name);
        }
      } catch (error) {
        this.logger.warn('Replicate не сработал:', error.message);
      }

      // 4. Заглушка
      this.logger.warn('Все API недоступны, используем PNG-заглушку');
      return this.getFallbackImage(holidayData);

    } catch (error) {
      this.logger.error('Ошибка генерации изображения:', error);
      return this.getFallbackImage(holidayData);
    }
  }

  /**
   * Генерация через Pollinations AI (бесплатно)
   */
  private async generateWithPollinations(holidayData: HolidayImageData): Promise<Buffer | null> {
    const prompt = holidayData.prompt || this.getDefaultPrompt(holidayData);
    const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt)
        + '?width=512&height=512&nologo=true';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.logger.log(`Pollinations попытка ${attempt}/3...`);

        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: { 'User-Agent': 'Telegram-Birthday-Bot/1.0' },
        });

        if (response.status !== 200 || !response.data) {
          this.logger.warn(`Pollinations попытка ${attempt}: статус ${response.status}`);
          continue;
        }

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('image/')) {
          this.logger.warn(`Pollinations попытка ${attempt}: не изображение (${contentType})`);
          continue;
        }

        const buffer = Buffer.from(response.data);
        if (!this.isValidImage(buffer)) {
          this.logger.warn(`Pollinations попытка ${attempt}: невалидный файл`);
          continue;
        }

        return buffer;
      } catch (error) {
        this.logger.warn(`Pollinations ошибка (попытка ${attempt}): ${error.message}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    return null;
  }

  /**
   * Проверка что буфер является валидным изображением (PNG или JPEG)
   */
  private isValidImage(buffer: Buffer): boolean {
    if (buffer.length < 8) return false;

    // PNG: начинается с 89 50 4E 47 0D 0A 1A 0A
    const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;

    // JPEG: начинается с FF D8 FF
    const isJpeg =
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;

    return isPng || isJpeg;
  }

  /**
   * Генерация через Replicate API
   */
  private async generateWithReplicate(holidayData: HolidayImageData): Promise<Buffer | null> {
    try {
      const apiKey = this.configService.get<string>('REPLICATE_API_TOKEN');
      if (!apiKey) return null;

      const prompt = holidayData.prompt || this.getDefaultPrompt(holidayData);

      const response = await axios.post(
          'https://api.replicate.com/v1/predictions',
          {
            version: '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
            input: {
              prompt,
              width: 512,
              height: 512,
              num_outputs: 1,
              num_inference_steps: 25,
              guidance_scale: 7.5,
            },
          },
          {
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
      );

      const predictionUrl = response.data?.urls?.get;
      if (!predictionUrl) return null;

      // Polling — ждём результата (макс ~2 минуты)
      for (let i = 0; i < 24; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const poll = await axios.get(predictionUrl, {
          headers: { Authorization: `Token ${apiKey}` },
          timeout: 10000,
        });

        const status = poll.data?.status;
        this.logger.log(`Replicate статус: ${status}`);

        if (status === 'succeeded' && poll.data?.output?.length > 0) {
          const imageUrl = poll.data.output[0];
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          const buf = Buffer.from(imageResponse.data);
          return this.isValidImage(buf) ? buf : null;
        }

        if (status === 'failed' || status === 'canceled') {
          this.logger.warn(`Replicate завершился со статусом: ${status}`);
          this.logger.warn(JSON.stringify(poll.data?.error));
          return null;
        }
      }

      this.logger.warn('Replicate: таймаут ожидания результата');
      return null;

    } catch (error) {
      this.logger.warn('Replicate ошибка:', error.message);
      this.logger.warn(JSON.stringify(error.response?.data));
      return null;
    }
  }

  /**
   * Сохранение изображения
   */
  private saveImage(imageBuffer: Buffer, holidayName: string): Buffer {
    const filename = `${holidayName}-${Date.now()}.png`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    this.logger.log(`Изображение сохранено: ${filepath}`);
    return imageBuffer;
  }

  /**
   * Промпт по умолчанию
   */
  private getDefaultPrompt(holidayData: HolidayImageData): string {
    const basePrompts = {
      '8 марта': `beautiful spring flowers, International Women's Day, pink and purple colors, festive atmosphere, high quality, detailed`,
      'Рождество': `Christmas tree, snow, winter wonderland, festive lights, warm colors, magical atmosphere, high quality`,
      'День рождения': `birthday cake with candles, colorful balloons, celebration, festive atmosphere, bright colors, high quality`,
    };
    return basePrompts[holidayData.name] || `festive celebration, colorful design, high quality, detailed image`;
  }

  /**
   * Резервное изображение — валидный PNG с цветом в зависимости от стиля
   */
  private getFallbackImage(holidayData: HolidayImageData): Buffer {
    try {
      const style = holidayData.style || 'friendly';
      const fallbackPath = path.join(this.outputDir, `fallback-${holidayData.name}-${style}.png`);
      if (fs.existsSync(fallbackPath)) {
        const buf = fs.readFileSync(fallbackPath);
        if (this.isValidImage(buf)) return buf;
      }
    } catch (_) {}

    this.logger.log(`Создаём PNG-заглушку для стиля ${holidayData.style || 'default'}`);
    return this.createSolidColorPng(holidayData.name, holidayData.style);
  }

  /**
   * ✅ Создаёт настоящий валидный PNG (512x512, сплошной цвет) в зависимости от стиля
   * Использует только встроенный zlib — без сторонних зависимостей
   */
  private createSolidColorPng(holidayName: string, style?: string): Buffer {
    const color = this.getHolidayStyleColorRgb(holidayName, style);
    const width = 512;
    const height = 512;

    // --- PNG signature ---
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // --- IHDR chunk ---
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;  // bit depth
    ihdrData[9] = 2;  // color type: RGB
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace
    const ihdr = this.buildPngChunk('IHDR', ihdrData);

    // --- IDAT chunk (raw scanlines) ---
    // Каждая строка: filter byte (0) + RGB пиксели
    const rawData = Buffer.alloc(height * (1 + width * 3));
    for (let y = 0; y < height; y++) {
      const rowStart = y * (1 + width * 3);
      rawData[rowStart] = 0; // filter type None
      for (let x = 0; x < width; x++) {
        const offset = rowStart + 1 + x * 3;
        rawData[offset] = color.r;
        rawData[offset + 1] = color.g;
        rawData[offset + 2] = color.b;
      }
    }
    const compressed = zlib.deflateSync(rawData);
    const idat = this.buildPngChunk('IDAT', compressed);

    // --- IEND chunk ---
    const iend = this.buildPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
  }

  /**
   * Сборка PNG чанка: длина + тип + данные + CRC32
   */
  private buildPngChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type, 'ascii');
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(data.length, 0);
    const crc = this.crc32(Buffer.concat([typeBuffer, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
  }

  /**
   * CRC32 для PNG чанков
   */
  private crc32(buf: Buffer): number {
    const table = this.getCrc32Table();
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private getCrc32Table(): number[] {
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  }

  private getHolidayStyleColorRgb(holidayName: string, style?: string): { r: number; g: number; b: number } {
    const styleColors = {
      '8 марта': {
        'official': '#4A90E2',    // Синий официальный
        'funny': '#FF69B4',      // Ярко-розовый веселый
        'poetic': '#DDA0DD',     // Пастельный сиреневый
        'friendly': '#FFB6C1',   // Теплый розовый
        'romantic': '#FF1493'    // Глубокий розовый
      },
      'День рождения': {
        'official': '#2E8B57',    // Темно-зеленый официальный
        'funny': '#FFD700',      // Золотой веселый
        'poetic': '#9370DB',     // Фиолетовый поэтический
        'friendly': '#FFA500',   // Оранжевый дружеский
        'romantic': '#FF69B4'    // Розовый романтичный
      },
      'Новый год': {
        'official': '#2F4F4F',    // Темно-серый официальный
        'funny': '#FF4500',      // Красно-оранжевый веселый
        'poetic': '#4682B4',     // Стальной поэтический
        'friendly': '#228B22',   // Зеленый дружеский
        'romantic': '#DC143C'    // Алый романтичный
      }
    };

    const holidayStyle = styleColors[holidayName]?.[style];
    if (holidayStyle) {
      const hex = holidayStyle.replace('#', '');
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }

    // Фолбэк на обычные цвета
    return this.getHolidayColorRgb(holidayName);
  }

  private getHolidayColor(holidayName: string): string {
    const colors = {
      '8 марта': '#FF69B4',
      'Рождество': '#228B22',
      'День рождения': '#FFD700',
    };
    return colors[holidayName] || '#4169E1';
  }

  private getHolidayColorRgb(holidayName: string): { r: number; g: number; b: number } {
    const hex = this.getHolidayColor(holidayName).replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }

  cleanupOldImages(): void {
    try {
      const files = fs.readdirSync(this.outputDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;

      files.forEach(file => {
        const filepath = path.join(this.outputDir, file);
        const stats = fs.statSync(filepath);
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filepath);
          this.logger.log(`Удален старый файл: ${file}`);
        }
      });
    } catch (error) {
      this.logger.error('Ошибка очистки старых изображений:', error);
    }
  }
  private async generateWithStableHorde(holidayData: HolidayImageData): Promise<Buffer | null> {
    try {
      const apiKey = this.configService.get<string>('STABLE_HORDE_API_KEY') || '0000000000';
      const prompt = this.getDefaultPrompt(holidayData);

      const job = await axios.post(
          'https://stablehorde.net/api/v2/generate/async',
          {
            prompt,
            params: { width: 512, height: 512, steps: 20, n: 1 },
            r2: false,
          },
          {
            headers: {
              'apikey': apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
      );

      const jobId = job.data?.id;
      if (!jobId) return null;

      this.logger.log(`StableHorde job: ${jobId}`);

      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const check = await axios.get(
            `https://stablehorde.net/api/v2/generate/check/${jobId}`,
            { timeout: 10000 }
        );

        this.logger.log(`StableHorde: done=${check.data?.done}, queue=${check.data?.queue_position}`);

        if (check.data?.done) {
          const result = await axios.get(
              `https://stablehorde.net/api/v2/generate/status/${jobId}`,
              { timeout: 10000 }
          );

          const imageBase64 = result.data?.generations?.[0]?.img;
          if (imageBase64) {
            const buf = Buffer.from(imageBase64, 'base64');
            return this.isValidImage(buf) ? buf : null;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('StableHorde ошибка:', error.message);
      return null;
    }
  }
}
