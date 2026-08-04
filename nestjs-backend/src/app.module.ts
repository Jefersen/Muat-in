import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ItemsModule } from './items/items.module';
import { TrucksModule } from './trucks/trucks.module';
import { PlansModule } from './plans/plans.module';

@Module({
  imports: [
    // Register Configuration globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    ItemsModule,
    TrucksModule,
    PlansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
