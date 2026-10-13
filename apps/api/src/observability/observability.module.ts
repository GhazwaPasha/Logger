import { Global, Module } from "@nestjs/common";
import { TelemetryController } from "./telemetry.controller";
import { UsageMonitorService } from "./usage-monitor.service";

@Global()
@Module({
  controllers: [TelemetryController],
  providers: [UsageMonitorService],
  exports: [UsageMonitorService],
})
export class ObservabilityModule {}
