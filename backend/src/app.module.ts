import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.getOrThrow<string>('MONGO_HOST');
        const port = configService.getOrThrow<string>('MONGO_PORT');
        const username = configService.getOrThrow<string>(
          'MONGO_INITDB_ROOT_USERNAME',
        );
        const password = configService.getOrThrow<string>(
          'MONGO_INITDB_ROOT_PASSWORD',
        );
        const database = configService.getOrThrow<string>(
          'MONGO_INITDB_DATABASE',
        );
        const authSource = configService.get<string>(
          'MONGO_AUTH_SOURCE',
          'admin',
        );

        return {
          uri: `mongodb://${username}:${password}@${host}:${port}/${database}`,
          authSource,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
