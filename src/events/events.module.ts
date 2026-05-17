import { Module } from '@nestjs/common';
import { RabbitMqConsumerService } from '../integrations/rabbitmq-consumer.service';
import { MatchesModule } from '../matches/matches.module';
import { UsersModule } from '../users/users.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [MatchesModule, UsersModule, ProfilesModule],
  providers: [RabbitMqConsumerService],
})
export class EventsModule {}
