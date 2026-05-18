import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: "webhook-delivery",
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>("REDIS_URL");
        if (!redisUrl) {
          const { default: IORedis } = await import("ioredis");
          return { connection: new IORedis({ lazyConnect: true, enableOfflineQueue: false }) };
        }
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: url.port ? parseInt(url.port, 10) : 6379,
            password: url.password || undefined,
            tls: url.protocol === "rediss:" ? {} : undefined,
          },
        };
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
