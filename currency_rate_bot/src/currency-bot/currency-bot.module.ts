import { Module } from '@nestjs/common';
import { CurrencyBotService } from './currency-bot.service';

@Module({
  providers: [CurrencyBotService],
})
export class CurrencyBotModule {}
