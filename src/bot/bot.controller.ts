import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { BotService } from './bot.service';

/**
 * DTO для отправки тестового сообщения
 */
export class SendMessageDto {
  message: string;
}

/**
 * Контроллер для управления ботом через HTTP API
 * Позволяет отправлять тестовые сообщения и получать статус бота
 */
@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  /**
   * Получить информацию о боте
   * GET /bot/info
   */
  @Get('info')
  async getBotInfo() {
    try {
      const botInfo = await this.botService.getBotInfo();
      return {
        success: true,
        data: botInfo,
        message: 'Информация о боте получена',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Ошибка получения информации о боте',
      };
    }
  }

  /**
   * Отправить тестовое сообщение
   * POST /bot/send
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    try {
      await this.botService.sendTestMessage(sendMessageDto.message);
      return {
        success: true,
        message: 'Сообщение успешно отправлено',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Ошибка отправки сообщения',
      };
    }
  }

  /**
   * Проверить статус бота
   * GET /bot/status
   */
  @Get('status')
  getStatus() {
    return {
      success: true,
      message: 'Бот работает нормально',
      timestamp: new Date().toISOString(),
    };
  }
}
