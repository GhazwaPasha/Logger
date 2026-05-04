import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";

@Module({
  imports: [RealtimeModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
