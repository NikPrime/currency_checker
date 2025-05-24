import { Module } from '@nestjs/common';
import { CurrencyBotService } from './currency-bot.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

const kafkaCredentials = process.env.KAFKA_BROKERS || 'localhost:29092'

@Module({
  imports: [
      ClientsModule.register([
          {
            name: 'KAFKA_SERVICE',
            transport: Transport.KAFKA,
            options: {
              client: {
                brokers: [kafkaCredentials],
              },
            },
          },
      ]),
  ],
  providers: [CurrencyBotService],
})
export class CurrencyBotModule {}
