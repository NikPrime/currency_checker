import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import { CURRENCY_PAIRS, QUOTE_CURRENCIES } from 'src/constants';
import { GET_BINANCE_CURRENCIES } from 'api';
import { createClient } from 'redis';
import { ClientKafka, MessagePattern, Payload } from '@nestjs/microservices';

function splitPair(pair: string): [string, string] {
  const quote = QUOTE_CURRENCIES.find((q) => pair.endsWith(q));
  if (!quote) return [pair, ''];
  const base = pair.slice(0, pair.length - quote.length);
  return [base, quote];
}

interface Subscription {
  pair: string;
  direction: 'up' | 'down';
}

@Injectable()
export class CurrencyBotService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyBotService.name);
  private readonly bot = new Telegraf(process.env.BOT_TOKEN || '');
  private readonly subscriptions = new Map<number, Subscription[]>();

  private redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) { }

  async onModuleInit() {
    await this.redisClient.connect();
    await this.saveRates();

    this.setupBot();
    this.bot.launch();
    this.logger.log('Telegram bot launched');
  }

  private setupBot() {
    this.bot.start((ctx) => {
      ctx.reply('Выбери валютную пару:', {
        reply_markup: {
          inline_keyboard: CURRENCY_PAIRS.map((pair) => {
            const [base, quote] = splitPair(pair);
            return [{ text: `${base}/${quote}`, callback_data: `pair_${pair}` }];
          })
        },
      });
    });

    this.bot.action(/^pair_(.+)$/, async (ctx) => {
      const pair = ctx.match[1];
      const rate = await this.getRate(pair);
      await ctx.reply(`Курс ${pair.slice(0, 3)}/${pair.slice(3)}: ${rate}`);
      await ctx.reply(`Хочешь подписаться на уведомления при изменении?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📈 При росте', callback_data: `sub_${pair}_up` },
              { text: '📉 При падении', callback_data: `sub_${pair}_down` },
            ],
          ],
        },
      });
    });

    this.bot.action(/^sub_(.+)_(up|down)$/, async (ctx) => {
      const pair = ctx.match[1];
      const direction = ctx.match[2] as 'up' | 'down';

      if (!ctx.chat) {
        await ctx.reply('Ошибка: не удалось определить чат.');
        return;
      }
      const chatId = ctx.chat.id;
      const current = this.subscriptions.get(chatId) || [];
      current.push({ pair, direction });
      this.subscriptions.set(chatId, current);
      await ctx.reply(`Подписка оформлена: ${pair} при ${direction === 'up' ? 'росте' : 'падении'}`);
    });
  }

  private async getRate(pairName: string): Promise<number> {
    const pair = await this.redisClient.get(pairName);
    return parseFloat(pair || '0');
  }

  @Cron('* * * * *')
  async saveRates() {
    this.logger.log('⏰ SaveRates: Cron is starting!');

    try {
      const { data } = await axios.get(GET_BINANCE_CURRENCIES);
      const ratesMap = new Map(data.map((d: { symbol: any; price: string; }) => [d.symbol, parseFloat(d.price)]));

      const kafkaMessage: { symbol: string; rate: string }[] = [];

      for (const pair of CURRENCY_PAIRS) {
        const rate = Number(ratesMap.get(pair));
        if (rate !== undefined) {
          await this.redisClient.set(pair, rate.toString());
          kafkaMessage.push({ symbol: pair, rate: rate.toString() })
        }
      }

      this.kafkaClient.emit('currency.update', {
        timestamp: Date.now(),
        pairsInfo: kafkaMessage,
      });

      this.logger.log('⏰ SaveRates: Cron is starting!');
    } catch (e) {
      this.logger.error('❌ SaveRates: Cron failed with error', e);
    }
  }

  @MessagePattern('user.notify')
  handleNotification(@Payload() message: any) {
    this.bot.telegram.sendMessage(message.chatId, message)
  }
}
